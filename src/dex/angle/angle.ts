import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  AngleData,
  AngleToken,
  TokenType,
  CollateralMap,
  PoolState,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { AngleConfig, Adapters } from './config';
import { Interface } from '@ethersproject/abi';
import { computeMint, computeBurn } from './helpers';
import abiPoolManager from '../../abi/angle/pool-manager.json';
import abiStableMaster from '../../abi/angle/stablemaster.json';
import abiPerpetualManager from '../../abi/angle/perpetual-manager.json';

export class Angle extends SimpleExchange implements IDex<AngleData> {
  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AngleConfig);

  logger: Logger;

  interfaces = {
    poolmanager: new Interface(abiPoolManager),
    stablemaster: new Interface(abiStableMaster),
    perpetualmanager: new Interface(abiPerpetualManager),
    oracle: new Interface([
      'function read() external view returns (uint256 rate)',
      'function readLower() external view returns (uint256 rate)',
      'function readUpper() external view returns (uint256 rate)',
    ]),
  };
  tokens: Record<Address, AngleToken>;

  latestState: PoolState = { collateralMaps: {} };

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly config = AngleConfig[dexKey][network],
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);

    this.tokens = Object.values(config.agEUR.collaterals).reduce(
      (acc, token) => {
        acc[token.address.toLowerCase()] = token;
        return acc;
      },
      {
        [config.agEUR.address.toLowerCase()]: {
          symbol: 'agEUR',
          address: config.agEUR.address,
          decimals: config.agEUR.decimals,
          type: TokenType.AgToken,
        },
      } as Record<Address, AngleToken>,
    );
  }

  async getState(blockNumber: number | 'latest' = 'latest') {
    const collaterals = Object.values(this.config.agEUR.collaterals);

    for (let collateral of collaterals) {
      const stableMasterData = await this.dexHelper.multiContract.methods
        .aggregate([
          {
            target: this.config.agEUR.stableMaster,
            callData: this.interfaces.stablemaster.encodeFunctionData(
              'collateralMap',
              [collateral.poolManager],
            ),
          },
          {
            target: this.config.agEUR.stableMaster,
            callData: this.interfaces.stablemaster.encodeFunctionData(
              'getCollateralRatio',
              [],
            ),
          },
        ])
        .call({}, blockNumber);

      const collateralMap = this.interfaces.stablemaster.decodeFunctionResult(
        'collateralMap',
        stableMasterData.returnData[0],
      )[0] as CollateralMap;

      this.latestState.collateralMaps[collateral.address.toLowerCase()] =
        collateralMap;
    }
  }

  async initializePricing(blockNumber: number) {
    await this.getState(blockNumber);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolManager(srcToken: Token, destToken: Token): string | null {
    if (srcToken.address.toLowerCase() === destToken.address.toLowerCase())
      return null;

    const agEUR =
      AngleConfig[this.dexKey][this.network].agEUR.address.toLowerCase();

    if (agEUR === srcToken.address.toLowerCase()) {
      const collateral = Object.values(
        AngleConfig[this.dexKey][this.network].agEUR.collaterals,
      ).find(
        collat =>
          collat.address.toLowerCase() === destToken.address.toLowerCase(),
      );

      if (collateral) return collateral.poolManager;
    }

    if (agEUR === destToken.address.toLowerCase()) {
      const collateral = Object.values(
        AngleConfig[this.dexKey][this.network].agEUR.collaterals,
      ).find(
        collat =>
          collat.address.toLowerCase() === srcToken.address.toLowerCase(),
      );

      if (collateral) return collateral.poolManager;
    }
    return null;
  }

  getIdentifier(srcToken: Token, destToken: Token): string | null {
    const poolManager = this.getPoolManager(srcToken, destToken);
    if (!poolManager) return null;
    return `${this.dexKey}_${poolManager}`;
  }

  async getPoolIdentifiers(
    _srcToken: Token,
    _destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const srcToken = this.dexHelper.config.wrapETH(_srcToken);
    const destToken = this.dexHelper.config.wrapETH(_destToken);

    const id = this.getIdentifier(srcToken, destToken);
    if (!id) return [];
    return [id];
  }

  async computePrices(
    srcToken: AngleToken,
    destToken: AngleToken,
    amounts: bigint[],
    type: 'mint' | 'burn',
    blockNumber: number | 'latest' = 'latest',
  ) {
    const poolManager =
      type === 'mint' ? srcToken.poolManager : destToken.poolManager;

    const stableMasterData = await this.dexHelper.multiContract.methods
      .aggregate([
        {
          target: this.config.agEUR.stableMaster,
          callData: this.interfaces.stablemaster.encodeFunctionData(
            'collateralMap',
            [poolManager],
          ),
        },
        {
          target: this.config.agEUR.stableMaster,
          callData: this.interfaces.stablemaster.encodeFunctionData(
            'getCollateralRatio',
            [],
          ),
        },
      ])
      .call({}, blockNumber);

    const collateralMap = this.interfaces.stablemaster.decodeFunctionResult(
      'collateralMap',
      stableMasterData.returnData[0],
    ) as unknown as CollateralMap;

    const collateralRatio = this.interfaces.stablemaster
      .decodeFunctionResult(
        'getCollateralRatio',
        stableMasterData.returnData[1],
      )[0]
      .toBigInt() as bigint;

    const nextData = await this.dexHelper.multiContract.methods
      .aggregate([
        {
          target: collateralMap.perpetualManager,
          callData: this.interfaces.perpetualmanager.encodeFunctionData(
            'totalHedgeAmount',
            [],
          ),
        },
        {
          target: collateralMap.oracle,
          callData: this.interfaces.oracle.encodeFunctionData('read', []),
        },
        {
          target: collateralMap.oracle,
          callData: this.interfaces.oracle.encodeFunctionData('readLower', []),
        },
        {
          target: collateralMap.oracle,
          callData: this.interfaces.oracle.encodeFunctionData('readUpper', []),
        },
      ])
      .call({}, blockNumber);
    const totalHedgeAmount = this.interfaces.perpetualmanager
      .decodeFunctionResult('totalHedgeAmount', nextData.returnData[0])[0]
      .toBigInt() as bigint;
    const oracleRate = this.interfaces.oracle
      .decodeFunctionResult('read', nextData.returnData[1])[0]
      .toBigInt() as bigint;
    const oracleRateLower = this.interfaces.oracle
      .decodeFunctionResult('readLower', nextData.returnData[2])[0]
      .toBigInt() as bigint;
    const oracleRateUpper = this.interfaces.oracle
      .decodeFunctionResult('readUpper', nextData.returnData[3])[0]
      .toBigInt() as bigint;

    let prices: bigint[] = [];

    for (const amount of amounts) {
      if (amount === 0n) {
        prices.push(0n);
        continue;
      }

      if (type === 'mint') {
        const { amountForUserInStable, mintingFee } = computeMint(
          amount,
          srcToken.decimals,
          oracleRateLower,
          totalHedgeAmount,
          collateralMap.stocksUsers,
          collateralRatio,
          collateralMap.feeData.targetHAHedge,
          collateralMap.feeData.xFeeMint,
          collateralMap.feeData.yFeeMint,
          [0],
          [collateralMap.feeData.bonusMalusMint],
        );

        prices.push(amountForUserInStable.toBigInt());
      }

      if (type === 'burn') {
        const { amountForUserInCollateral, burningFee } = computeBurn(
          amount,
          srcToken.decimals,
          oracleRateUpper,
          totalHedgeAmount,
          collateralMap.stocksUsers,
          collateralRatio,
          collateralMap.feeData.targetHAHedge,
          collateralMap.feeData.xFeeBurn,
          collateralMap.feeData.yFeeBurn,
          [0],
          [collateralMap.feeData.bonusMalusBurn],
        );

        prices.push(amountForUserInCollateral.toBigInt());
      }
    }

    return prices;
  }

  async getPricesVolume(
    _srcToken: Token,
    _destToken: Token,
    _amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<AngleData>> {
    const srcToken = this.dexHelper.config.wrapETH(_srcToken);
    const destToken = this.dexHelper.config.wrapETH(_destToken);

    const srcAddress = srcToken.address.toLowerCase();
    const destAddress = destToken.address.toLowerCase();

    if (srcAddress === destAddress) return null;

    const srcAngleToken = this.tokens[srcAddress];
    const destAngleToken = this.tokens[destAddress];

    if (!srcAngleToken || !destAngleToken) return null;

    const poolIdentifier = this.getIdentifier(srcToken, destToken);
    if (!poolIdentifier) return null;
    if (limitPools && !limitPools.includes(poolIdentifier)) return null;

    const unitVolume = 10n ** BigInt(_srcToken.decimals);
    const amounts = [unitVolume, ..._amounts];

    const [unit, ...prices] = await this.computePrices(
      srcAngleToken,
      destAngleToken,
      amounts,
      this.tokens[srcAddress].type === TokenType.AgToken ? 'burn' : 'mint',
      blockNumber,
    );

    return [
      {
        unit,
        prices,
        data: { exchange: this.dexKey },
        exchange: this.dexKey,
        gasCost: 100_000,
        poolIdentifier,
      },
    ];
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AngleData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: '',
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AngleData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    let swapData: string;

    if (srcToken.toLowerCase() === this.config.agEUR.address) {
      const poolManager = this.tokens[destToken.toLowerCase()].poolManager;

      swapData = this.interfaces.stablemaster.encodeFunctionData('burn', [
        srcAmount,
        this.augustusAddress,
        this.augustusAddress,
        poolManager,
        0,
      ]);
    } else {
      const poolManager = this.tokens[srcToken.toLowerCase()].poolManager;
      swapData = this.interfaces.stablemaster.encodeFunctionData('mint', [
        srcAmount,
        this.augustusAddress,
        poolManager,
        0,
      ]);
    }

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.agEUR.stableMaster,
    );
  }

  async updatePoolState(): Promise<void> {
    await this.getState('latest');
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (
      tokenAddress.toLowerCase() === this.config.agEUR.address.toLowerCase()
    ) {
      const pools = Object.values(this.config.agEUR.collaterals).map(token => {
        return {
          exchange: this.dexKey,
          address: token.poolManager,
          connectorTokens: [
            {
              address: this.config.agEUR.address,
              decimals: this.config.agEUR.decimals,
            },
          ],
          liquidityUSD: Number(
            this.latestState.collateralMaps[tokenAddress.toLowerCase()]
              .stocksUsers,
          ),
        };
      });
      return pools;
    }

    const token = this.tokens[tokenAddress.toLowerCase()];
    if (token) {
      return [
        {
          exchange: this.dexKey,
          address: token.poolManager,
          connectorTokens: [
            {
              address: this.config.agEUR.address,
              decimals: this.config.agEUR.decimals,
            },
          ],
          liquidityUSD: Number(
            this.latestState.collateralMaps[tokenAddress.toLowerCase()]
              .stocksUsers,
          ),
        },
      ];
    }
    return [];
  }
}
