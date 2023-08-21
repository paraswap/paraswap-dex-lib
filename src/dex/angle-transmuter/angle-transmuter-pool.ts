import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  Chainlink,
  DecodedOracleConfig,
  OracleFeed,
  OracleReadType,
  PoolState,
  Pyth,
} from './types';
import TransmuterABI from '../../abi/angle-transmuter/Transmuter.json';
import { formatUnits } from 'ethers/lib/utils';
import { BigNumber, ethers } from 'ethers';
import { CBETH, RETH, SFRXETH, STETH } from './constants';

export class AngleTransmuterEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: PoolState,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected angleTransmuterIface = new Interface(TransmuterABI),
    readonly transmuter: Address, // TODO: add any additional params required for event subscriber
  ) {
    // TODO: Add pool name
    super(parentName, 'Transmuter', dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.angleTransmuterIface.parseLog(log);
    this.addressesSubscribed = [transmuter];

    // Add handlers
    this.handlers['FeesSet'] = this.handleFeesSet.bind(this);
    this.handlers['RedemptionCurveParamsSet'] =
      this.handleRedemptionCurveSet.bind(this);
    this.handlers['OracleSet'] = this.handleOracleSet.bind(this);
    this.handlers['Swap'] = this.handleSwap.bind(this);
    this.handlers['Redeemed'] = this.handleRedeem.bind(this);
    // TODO need to add:
    // - add/remove collaterals
    // - pause/unpause collaterals
    // - reserveAdjusted as it can change exposures
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: PoolState,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    // TODO: complete me!
    return {} as PoolState;
  }

  /**
   * Update Mint and Burn fees parameters
   */
  handleFeesSet(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): Readonly<PoolState> | null {
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
  handleRedemptionCurveSet(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): Readonly<PoolState> | null {
    const xFee: BigInt[] = event.args.xFee;
    const yFee: BigInt[] = event.args.yFee;
    state.xRedemptionCurve = xFee;
    state.yRedemptionCurve = yFee;
    return state;
  }

  /**
   * Adapt collateral exposure after a swap event
   */
  handleSwap(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): Readonly<PoolState> | null {
    const tokenIn: string = event.args.tokenIn;
    const tokenOut: string = event.args.tokenOut;
    // in case of a burn
    if (tokenIn == state.stablecoin.address) {
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
  handleRedeem(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): Readonly<PoolState> | null {
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
  handleOracleSet(
    event: any,
    state: PoolState,
    log: Readonly<Log>,
  ): Readonly<PoolState> | null {
    const collateral: string = event.args.collateral;
    const oracleConfig: string = event.args.oracleConfig;

    const oracleConfigDecoded: DecodedOracleConfig =
      ethers.utils.defaultAbiCoder.decode(
        [
          `
        uint8 oracleType,
        uint8 targetType,
        bytes memory oracleData,
        bytes memory targetData
        `,
        ],
        oracleConfig,
      )[0];

    state.collaterals[collateral].oracles.config.oracleType =
      oracleConfigDecoded.oracleType;
    state.collaterals[collateral].oracles.config.targetType =
      oracleConfigDecoded.targetType;
    if (oracleConfigDecoded.oracleType == OracleReadType.EXTERNAL) {
      const externalOracle: Address = ethers.utils.defaultAbiCoder.decode(
        [
          `
          address externalOracle
          `,
        ],
        oracleConfigDecoded.oracleData,
      )[0];
      state.collaterals[collateral].oracles.config.externalOracle =
        externalOracle;
      this.addressesSubscribed.push(externalOracle);
    } else {
      state.collaterals[collateral].oracles.config.oracleFeed =
        this._decodeOracleFeed(
          oracleConfigDecoded.oracleType,
          oracleConfigDecoded.oracleData,
        );
      state.collaterals[collateral].oracles.config.targetFeed =
        this._decodeOracleFeed(
          oracleConfigDecoded.targetType,
          oracleConfigDecoded.targetData,
        );
      // subscribe
    }

    return state;
  }

  _decodeOracleFeed(readType: OracleReadType, oracleData: string): OracleFeed {
    if (readType == OracleReadType.CHAINLINK_FEEDS)
      return {
        isChainlink: true,
        isPyth: false,
        chainlink: this._decodeChainlinkOracle(oracleData),
      };
    else if (readType == OracleReadType.PYTH)
      return {
        isChainlink: false,
        isPyth: true,
        pyth: this._decodePythOracle(oracleData),
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

  _decodeChainlinkOracle(oracleData: string): Chainlink {
    const chainlinkOracleDecoded: Chainlink =
      ethers.utils.defaultAbiCoder.decode(
        [
          `
        address[] memory circuitChainlink,
        uint32[] memory stalePeriods,
        uint8[] memory circuitChainIsMultiplied,
        uint8[] memory chainlinkDecimals,
        uint8 quoteType
        `,
        ],
        oracleData,
      )[0];

    return chainlinkOracleDecoded;
  }

  _decodePythOracle(oracleData: string): Pyth {
    const pythOracleDecoded: Pyth = ethers.utils.defaultAbiCoder.decode(
      [
        `
        address pyth,
        bytes32[] memory feedIds,
        uint32[] memory stalePeriods,
        uint8[] memory isMultiplied,
        uint8 quoteType
        `,
      ],
      oracleData,
    )[0];

    return pythOracleDecoded;
  }
}
