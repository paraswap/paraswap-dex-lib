import { DeepReadonly } from 'ts-essentials';
import { PartialEventSubscriber } from '../../composed-event-subscriber';
import {
  Address,
  BlockHeader,
  Log,
  Logger,
  MultiCallInput,
  MultiCallOutput,
} from '../../types';
import { CBETH, RETH, SFRXETH, STETH } from './constants';
import { Lens } from '../../lens';
import { Interface } from '@ethersproject/abi';
import TransmuterABI from '../../abi/angle-transmuter/Transmuter.json';
import {
  DecodedOracleConfig,
  Chainlink,
  OracleFeed,
  OracleReadType,
  Pyth,
  TransmuterState,
  Fees,
  Oracle,
} from './types';
import _ from 'lodash';
import { BigNumber, ethers } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';
import { filterDictionaryOnly } from './utils';

export class TransmuterSubscriber<State> extends PartialEventSubscriber<
  State,
  TransmuterState
> {
  static readonly interface = new Interface(TransmuterABI);

  constructor(
    private agEUR: Address,
    private transmuter: Address,
    private collaterals: Address[],
    lens: Lens<DeepReadonly<State>, DeepReadonly<TransmuterState>>,
    logger: Logger,
  ) {
    super([transmuter], lens, logger);
  }

  public processLog(
    state: DeepReadonly<TransmuterState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<TransmuterState> | null {
    try {
      const parsed = TransmuterSubscriber.interface.parseLog(log);
      const _state: TransmuterState = _.cloneDeep(state) as TransmuterState;
      // TODO support add collaterals
      switch (parsed.name) {
        case 'FeesSet':
          return this._handleFeesSet(parsed, _state);
        case 'RedemptionCurveParamsSet':
          return this._handleRedemptionCurveSet(parsed, _state);
        case 'OracleSet':
          return this._handleOracleSet(parsed, _state);
        case 'Swap':
          return this._handleSwap(parsed, _state);
        case 'Redeemed':
          return this._handleRedeem(parsed, _state);
        default:
          return null;
      }
    } catch (e) {
      this.logger.error('Failed to parse log', e);
      return null;
    }
  }

  public getGenerateStateMultiCallInputs(): MultiCallInput[] {
    return [
      ...this.collaterals.map(collat => ({
        target: this.transmuter,
        callData: TransmuterSubscriber.interface.encodeFunctionData(
          'getIssuedByCollateral',
          [collat],
        ),
      })),
      ...this.collaterals.map(collat => ({
        target: this.transmuter,
        callData: TransmuterSubscriber.interface.encodeFunctionData(
          'getOracle',
          [collat],
        ),
      })),
      ...this.collaterals.map(collat => ({
        target: this.transmuter,
        callData: TransmuterSubscriber.interface.encodeFunctionData(
          'getCollateralMintFees',
          [collat],
        ),
      })),
      ...this.collaterals.map(collat => ({
        target: this.transmuter,
        callData: TransmuterSubscriber.interface.encodeFunctionData(
          'getCollateralBurnFees',
          [collat],
        ),
      })),
      {
        target: this.transmuter,
        callData:
          TransmuterSubscriber.interface.encodeFunctionData(
            'getRedemptionFees',
          ),
      },
      {
        target: this.transmuter,
        callData:
          TransmuterSubscriber.interface.encodeFunctionData('getTotalIssued'),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<TransmuterState> {
    let transmuterState = {
      collaterals: {},
      totalStablecoinIssued: 0,
      xRedemptionCurve: [],
      yRedemptionCurve: [],
    } as TransmuterState;

    const nbrCollaterals = this.collaterals.length;
    const indexStableIssued = 0;
    const indexOracleFees = 1;
    const indexMintFees = 2;
    const indexBurnFees = 3;

    this.collaterals.forEach(
      (collat: Address, i: number) =>
        (transmuterState.collaterals[collat] = {
          fees: {
            xFeeMint: (
              TransmuterSubscriber.interface.decodeFunctionResult(
                'getCollateralMintFees',
                multicallOutputs[indexMintFees * nbrCollaterals + i],
              )[0] as BigNumber[]
            ).map(f => parseFloat(formatUnits(f, 9))),
            yFeeMint: (
              TransmuterSubscriber.interface.decodeFunctionResult(
                'getCollateralMintFees',
                multicallOutputs[indexMintFees * nbrCollaterals + i],
              )[1] as BigNumber[]
            ).map(f => parseFloat(formatUnits(f, 9))),
            xFeeBurn: (
              TransmuterSubscriber.interface.decodeFunctionResult(
                'getCollateralBurnFees',
                multicallOutputs[indexBurnFees * nbrCollaterals + i],
              )[0] as BigNumber[]
            ).map(f => parseFloat(formatUnits(f, 9))),
            yFeeBurn: (
              TransmuterSubscriber.interface.decodeFunctionResult(
                'getCollateralBurnFees',
                multicallOutputs[indexBurnFees * nbrCollaterals + i],
              )[1] as BigNumber[]
            ).map(f => parseFloat(formatUnits(f, 9))),
          } as Fees,
          stablecoinsIssued: parseFloat(
            formatUnits(
              TransmuterSubscriber.interface.decodeFunctionResult(
                'getIssuedByCollateral',
                multicallOutputs[indexStableIssued * nbrCollaterals + i],
              )[0],
              18,
            ),
          ),
          oracles: {
            collateralMintPrice: 0,
            collateralBurnPrice: 0,
            config: this._setOracleConfig(
              multicallOutputs[indexOracleFees * nbrCollaterals + i],
            ),
          },
        }),
    );
    transmuterState.xRedemptionCurve = (
      TransmuterSubscriber.interface.decodeFunctionResult(
        'getRedemptionFees',
        multicallOutputs[multicallOutputs.length - 2],
      )[0] as BigNumber[]
    ).map(f => parseFloat(formatUnits(f, 9)));
    transmuterState.yRedemptionCurve = (
      TransmuterSubscriber.interface.decodeFunctionResult(
        'getRedemptionFees',
        multicallOutputs[multicallOutputs.length - 2],
      )[1] as BigNumber[]
    ).map(f => parseFloat(formatUnits(f, 9)));
    transmuterState.totalStablecoinIssued = parseFloat(
      formatUnits(
        TransmuterSubscriber.interface.decodeFunctionResult(
          'getTotalIssued',
          multicallOutputs[multicallOutputs.length - 1],
        )[0],
        18,
      ),
    );
    return transmuterState;
  }

  /**
   * Update Mint and Burn fees parameters
   */
  _handleFeesSet(
    event: ethers.utils.LogDescription,
    state: TransmuterState,
  ): Readonly<TransmuterState> | null {
    const isMint: boolean = event.args.mint;
    const collateral: string = event.args.collateral;
    const xFee: BigNumber[] = event.args.xFee;
    const yFee: BigNumber[] = event.args.yFee;
    if (isMint) {
      state.collaterals[collateral].fees.xFeeMint = xFee.map(f =>
        parseFloat(formatUnits(f, 9)),
      );
      state.collaterals[collateral].fees.yFeeMint = yFee.map(f =>
        parseFloat(formatUnits(f, 9)),
      );
    } else {
      state.collaterals[collateral].fees.xFeeBurn = xFee.map(f =>
        parseFloat(formatUnits(f, 9)),
      );
      state.collaterals[collateral].fees.yFeeBurn = yFee.map(f =>
        parseFloat(formatUnits(f, 9)),
      );
    }
    return state;
  }

  /**
   * Update redemption curve parameters
   */
  _handleRedemptionCurveSet(
    event: ethers.utils.LogDescription,
    state: TransmuterState,
  ): Readonly<TransmuterState> | null {
    const xFee: BigNumber[] = event.args.xFee;
    const yFee: BigNumber[] = event.args.yFee;
    state.xRedemptionCurve = xFee.map(f => parseFloat(formatUnits(f, 9)));
    state.yRedemptionCurve = yFee.map(f => parseFloat(formatUnits(f, 9)));
    return state;
  }

  /**
   * Adapt collateral exposure after a swap event
   */
  _handleSwap(
    event: ethers.utils.LogDescription,
    state: TransmuterState,
  ): Readonly<TransmuterState> | null {
    const tokenIn: string = event.args.tokenIn;
    const tokenOut: string = event.args.tokenOut;
    // in case of a burn
    if (tokenIn.toLowerCase() == this.agEUR.toLowerCase()) {
      const amount: number = parseFloat(formatUnits(event.args.amountIn, 18));
      state.collaterals[tokenOut].stablecoinsIssued -= amount;
      state.totalStablecoinIssued -= amount;
    } else {
      const amount: number = parseFloat(formatUnits(event.args.amountOut, 18));
      state.collaterals[tokenIn].stablecoinsIssued += amount;
      state.totalStablecoinIssued += amount;
    }
    return state;
  }

  /**
   * Adapt collateral balances after a redeem event
   */
  _handleRedeem(
    event: ethers.utils.LogDescription,
    state: TransmuterState,
  ): Readonly<TransmuterState> | null {
    const amount: number = parseFloat(formatUnits(event.args.amount, 18));
    const currentStablecoinEmission = state.totalStablecoinIssued;
    for (const collat of Object.keys(state.collaterals)) {
      state.collaterals[collat].stablecoinsIssued -=
        (amount / currentStablecoinEmission) *
        state.collaterals[collat].stablecoinsIssued;
    }
    state.totalStablecoinIssued -= amount;

    return state;
  }

  /**
   * Keep track of used oracles for each collaterals
   */
  _handleOracleSet(
    event: ethers.utils.LogDescription,
    state: TransmuterState,
  ): Readonly<TransmuterState> | null {
    const collateral: string = event.args.collateral;
    const oracleConfig: string = event.args.oracleConfig;

    state.collaterals[collateral].oracles.config =
      this._setOracleConfig(oracleConfig);
    return state;
  }

  /**
   * Keep track of used oracles for each collaterals
   */
  _setOracleConfig(oracleConfig: string): Oracle {
    const conifgOracle = {} as Oracle;
    const oracleConfigDecoded =
      TransmuterSubscriber._decodeOracleConfig(oracleConfig);

    conifgOracle.oracleType = oracleConfigDecoded.oracleType;
    conifgOracle.targetType = oracleConfigDecoded.targetType;
    if (oracleConfigDecoded.oracleType == OracleReadType.EXTERNAL) {
      const externalOracle: Address = ethers.utils.defaultAbiCoder.decode(
        [`address externalOracle`],
        oracleConfigDecoded.oracleData,
      )[0];
      conifgOracle.externalOracle = externalOracle;
    } else {
      conifgOracle.oracleFeed = TransmuterSubscriber._decodeOracleFeed(
        oracleConfigDecoded.oracleType,
        oracleConfigDecoded.oracleData,
      );
      conifgOracle.targetFeed = TransmuterSubscriber._decodeOracleFeed(
        oracleConfigDecoded.targetType,
        oracleConfigDecoded.targetData,
      );
    }
    return conifgOracle;
  }

  static _decodeOracleConfig(oracleConfig: string): DecodedOracleConfig {
    const oracleConfigDecoded = filterDictionaryOnly(
      ethers.utils.defaultAbiCoder.decode(
        [
          'uint8 oracleType',
          'uint8 targetType',
          'bytes oracleData',
          'bytes targetData',
        ],
        oracleConfig,
      ),
    ) as unknown as DecodedOracleConfig;

    return oracleConfigDecoded;
  }

  static _decodeOracleFeed(
    readType: OracleReadType,
    oracleData: string,
  ): OracleFeed {
    if (readType == OracleReadType.CHAINLINK_FEEDS)
      return {
        isChainlink: true,
        isPyth: false,
        chainlink: TransmuterSubscriber._decodeChainlinkOracle(oracleData),
      };
    else if (readType == OracleReadType.PYTH)
      return {
        isChainlink: false,
        isPyth: true,
        pyth: TransmuterSubscriber._decodePythOracle(oracleData),
      };
    else if (readType == OracleReadType.WSTETH)
      return { isChainlink: false, isPyth: false, otherContract: STETH };
    else if (readType == OracleReadType.CBETH)
      return { isChainlink: false, isPyth: false, otherContract: CBETH };
    else if (readType == OracleReadType.RETH)
      return { isChainlink: false, isPyth: false, otherContract: RETH };
    else if (readType == OracleReadType.SFRXETH)
      return { isChainlink: false, isPyth: false, otherContract: SFRXETH };
    else return { isChainlink: false, isPyth: false };
  }

  static _decodeChainlinkOracle(oracleData: string): Chainlink {
    const chainlinkOracleDecoded = filterDictionaryOnly(
      ethers.utils.defaultAbiCoder.decode(
        [
          'address[] circuitChainlink',
          'uint32[] stalePeriods',
          'uint8[] circuitChainIsMultiplied',
          'uint8[] chainlinkDecimals',
          'uint8 quoteType',
        ],
        oracleData,
      ),
    ) as unknown as Chainlink;

    return chainlinkOracleDecoded;
  }

  static _decodePythOracle(oracleData: string): Pyth {
    const pythOracleDecoded = filterDictionaryOnly(
      ethers.utils.defaultAbiCoder.decode(
        [
          'address pyth',
          'bytes32[] feedIds',
          'uint32[] stalePeriods',
          'uint8[] isMultiplied',
          'uint8 quoteType',
        ],
        oracleData,
      ),
    ) as unknown as Pyth;

    return pythOracleDecoded;
  }
}
