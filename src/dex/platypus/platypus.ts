import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  MultiCallInput,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { getDexKeysWithNetwork, getBigIntPow, isETHAddress } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  DexParams,
  PlatypusOracleType,
  PlatypusData,
  PlatypusConfigInfo,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { PlatypusConfig, Adapters } from './config';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { PlatypusPoolBase } from './pool-base';
import { PlatypusPool } from './pool';
import { PlatypusPurePool } from './pool-pure';
import { PlatypusAvaxPool } from './pool-avax';
import ERC20ABI from '../../abi/erc20.json';
import PoolABI from '../../abi/platypus/pool.json';
import AvaxPoolABI from '../../abi/platypus/avax-pool.json';
import AssetABI from '../../abi/platypus/asset.json';
import OracleABI from '../../abi/platypus/oracle.json';

export class Platypus extends SimpleExchange implements IDex<PlatypusData> {
  static readonly erc20Interface = new Interface(ERC20ABI);
  static readonly poolInterface = new Interface(PoolABI);
  static readonly avaxPoolInterface = new Interface(AvaxPoolABI);
  static readonly assetInterface = new Interface(AssetABI);
  static readonly oracleInterface = new Interface(OracleABI);

  protected config: DexParams;
  protected cfgInfo?: PlatypusConfigInfo;
  protected poolLiquidityUSD?: { [poolAddress: string]: number };

  protected eventPools?: {
    [poolAddress: string]: PlatypusPool | PlatypusPurePool | PlatypusAvaxPool;
  };

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(PlatypusConfig);

  logger: Logger;

  constructor(
    protected dexHelper: IDexHelper,
    protected dexKey: string,
    protected adapters = Adapters[dexHelper.network], // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.config = PlatypusConfig[dexKey][dexHelper.network];
    this.logger = dexHelper.getLogger(`${dexKey}-${dexHelper.network}`);
  }

  async generateConfigInfo(blockNumber: number): Promise<PlatypusConfigInfo> {
    const cfgInfo: PlatypusConfigInfo = {
      poolAddresses: [],
      pools: {},
    };
    // Need to filter pools in case we are testing against an old block where the pool didn't exist!
    for (const p of this.config.pools) {
      // When there's no code, getCode should return '0x' but could return '0x0' instead
      if (
        (await this.dexHelper.web3Provider.eth.getCode(p.address, blockNumber))
          .length > 3
      ) {
        const poolAddress = p.address.toLowerCase();
        cfgInfo.poolAddresses.push(poolAddress);
        if (p.oracleType === PlatypusOracleType.None) {
          cfgInfo.pools[poolAddress] = {
            oracleType: PlatypusOracleType.None,
            tokenAddresses: [],
            tokens: {},
          };
        } else if (p.oracleType === PlatypusOracleType.ChainLink) {
          cfgInfo.pools[poolAddress] = {
            oracleType: PlatypusOracleType.ChainLink,
            priceOracleAddress: '',
            tokenAddresses: [],
            tokens: {},
          };
        } else if (p.oracleType === PlatypusOracleType.StakedAvax) {
          cfgInfo.pools[poolAddress] = {
            oracleType: PlatypusOracleType.StakedAvax,
            priceOracleAddress: '',
            tokenAddresses: [],
            tokens: {},
          };
        } else {
          throw new Error(`Invalid pool oracle type in ${this.dexKey}`);
        }
      }
    }
    let inputs: MultiCallInput[] = [];
    for (const poolAddress of cfgInfo.poolAddresses) {
      const pool = cfgInfo.pools[poolAddress];
      if (pool.oracleType !== PlatypusOracleType.None) {
        inputs.push({
          target: poolAddress,
          callData: Platypus.poolInterface.encodeFunctionData('getPriceOracle'),
        });
      }
      inputs.push({
        target: poolAddress,
        callData:
          Platypus.poolInterface.encodeFunctionData('getTokenAddresses'),
      });
    }
    let returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    let i = 0;
    for (const poolAddress of cfgInfo.poolAddresses) {
      const pool = cfgInfo.pools[poolAddress];
      if (pool.oracleType !== PlatypusOracleType.None) {
        pool.priceOracleAddress = Platypus.poolInterface
          .decodeFunctionResult('getPriceOracle', returnData[i++])[0]
          .toLowerCase();
      }
      pool.tokenAddresses = Platypus.poolInterface
        .decodeFunctionResult('getTokenAddresses', returnData[i++])[0]
        .map((a: Address) => a.toLowerCase());
    }
    inputs = [];
    for (const poolAddress of cfgInfo.poolAddresses) {
      const pool = cfgInfo.pools[poolAddress];
      for (const tokenAddress of pool.tokenAddresses) {
        inputs.push({
          target: tokenAddress,
          callData: Platypus.erc20Interface.encodeFunctionData('symbol'),
        });
        inputs.push({
          target: tokenAddress,
          callData: Platypus.erc20Interface.encodeFunctionData('decimals'),
        });
        inputs.push({
          target: poolAddress,
          callData: Platypus.poolInterface.encodeFunctionData('assetOf', [
            tokenAddress,
          ]),
        });
        if (pool.oracleType === PlatypusOracleType.ChainLink) {
          inputs.push({
            target: pool.priceOracleAddress,
            callData: Platypus.oracleInterface.encodeFunctionData(
              'getSourceOfAsset',
              [tokenAddress],
            ),
          });
        }
      }
    }
    returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    i = 0;
    for (const poolAddress of cfgInfo.poolAddresses) {
      const pool = cfgInfo.pools[poolAddress];
      for (const tokenAddress of pool.tokenAddresses) {
        const tokenSymbol = Platypus.erc20Interface.decodeFunctionResult(
          'symbol',
          returnData[i++],
        )[0];
        const tokenDecimals = Platypus.erc20Interface.decodeFunctionResult(
          'decimals',
          returnData[i++],
        )[0];
        const assetAddress = Platypus.poolInterface
          .decodeFunctionResult('assetOf', returnData[i++])[0]
          .toLowerCase();
        if (pool.oracleType === PlatypusOracleType.ChainLink) {
          const proxyAddress = Platypus.oracleInterface
            .decodeFunctionResult('getSourceOfAsset', returnData[i++])[0]
            .toLowerCase();
          pool.tokens[tokenAddress] = {
            tokenSymbol,
            tokenDecimals,
            assetAddress,
            chainlink: {
              proxyAddress,
              aggregatorAddress: '',
            },
          };
        } else {
          pool.tokens[tokenAddress] = {
            tokenSymbol,
            tokenDecimals,
            assetAddress,
          };
        }
      }
    }
    inputs = [];
    for (const poolAddress of cfgInfo.poolAddresses) {
      const pool = cfgInfo.pools[poolAddress];
      if (pool.oracleType === PlatypusOracleType.ChainLink) {
        for (const tokenAddress of pool.tokenAddresses) {
          inputs.push(
            ChainLinkSubscriber.getReadAggregatorMultiCallInput(
              pool.tokens[tokenAddress].chainlink.proxyAddress,
            ),
          );
        }
      }
    }
    returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    i = 0;
    for (const poolAddress of cfgInfo.poolAddresses) {
      const pool = cfgInfo.pools[poolAddress];
      if (pool.oracleType === PlatypusOracleType.ChainLink) {
        for (const tokenAddress of pool.tokenAddresses) {
          pool.tokens[tokenAddress].chainlink.aggregatorAddress =
            ChainLinkSubscriber.readAggregator(returnData[i++]).toLowerCase();
        }
      }
    }
    return cfgInfo;
  }

  async init(blockNumber: number) {
    if (this.cfgInfo) return;
    this.cfgInfo = await this.generateConfigInfo(blockNumber);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.init(blockNumber);
    if (!this.cfgInfo)
      throw new Error(
        `initializePricing: ${this.dexKey} cfgInfo still null after init`,
      );
    const eventPools: {
      [poolAddress: string]: PlatypusPool | PlatypusPurePool | PlatypusAvaxPool;
    } = {};
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      const cfgPool = this.cfgInfo.pools[poolAddress];
      const poolName = this.config.pools.find(
        p => p.address.toLowerCase() === poolAddress,
      )!.name;
      let pool: PlatypusPool | PlatypusPurePool | PlatypusAvaxPool;
      if (cfgPool.oracleType === PlatypusOracleType.None) {
        pool = new PlatypusPurePool(
          this.dexKey,
          this.network,
          poolName,
          poolAddress,
          cfgPool,
          this.dexHelper,
        );
      } else if (cfgPool.oracleType === PlatypusOracleType.ChainLink) {
        pool = new PlatypusPool(
          this.dexKey,
          this.network,
          poolName,
          poolAddress,
          cfgPool,
          this.dexHelper,
        );
      } else if (cfgPool.oracleType === PlatypusOracleType.StakedAvax) {
        pool = new PlatypusAvaxPool(
          this.dexKey,
          this.network,
          poolName,
          poolAddress,
          cfgPool,
          this.dexHelper,
        );
      } else {
        throw new Error(`${this.dexKey} cfgInfo invalid pool type`);
      }
      await (async <P>(p: P extends PlatypusPoolBase<infer S> ? P : never) => {
        const state = await p.generateState(blockNumber);
        p.setState(state, blockNumber);
      })(pool);
      pool.initialize(blockNumber);
      eventPools[poolAddress] = pool;
    }
    this.eventPools = eventPools;
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  protected findPools(
    srcTokenAddress: Address,
    destTokenAddress: Address,
  ): Address[] {
    if (!this.cfgInfo) return [];
    return Object.entries(this.cfgInfo.pools)
      .filter(
        ([poolAddress, poolConfig]) =>
          poolConfig.tokenAddresses.includes(srcTokenAddress) &&
          poolConfig.tokenAddresses.includes(destTokenAddress),
      )
      .map(([poolAddress, poolConfig]) => poolAddress);
  }

  protected getPoolIdentifier(poolAddress: Address): string {
    return `${this.dexKey}_${poolAddress}`;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) return [];
    return this.findPools(
      this.dexHelper.config.wrapETH(srcToken).address.toLowerCase(),
      this.dexHelper.config.wrapETH(destToken).address.toLowerCase(),
    ).map(p => this.getPoolIdentifier(p));
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<PlatypusData>> {
    if (side === SwapSide.BUY) return null;
    if (!this.eventPools) {
      this.logger.error(
        `Missing event pools for ${this.dexKey} in getPricesVolume`,
      );
      return null;
    }
    const srcTokenAddress = this.dexHelper.config
      .wrapETH(srcToken)
      .address.toLowerCase();
    const destTokenAddress = this.dexHelper.config
      .wrapETH(destToken)
      .address.toLowerCase();
    if (srcTokenAddress === destTokenAddress) return null;
    return (
      await Promise.all(
        this.findPools(srcTokenAddress, destTokenAddress)
          .filter(
            poolAddress =>
              !limitPools ||
              limitPools.includes(this.getPoolIdentifier(poolAddress)),
          )
          .map(poolAddress =>
            (async <P>(
              pool: P extends PlatypusPoolBase<infer S> ? P : never,
            ) => {
              let state = pool.getState(blockNumber);
              if (!state) {
                state = await pool.generateState(blockNumber);
                pool.setState(state, blockNumber);
              }
              if (state.params.paused) return null;
              const [unit, ...prices] = pool.computePrices(
                {
                  address: srcTokenAddress,
                  decimals: srcToken.decimals,
                },
                {
                  address: destTokenAddress,
                  decimals: destToken.decimals,
                },
                [getBigIntPow(srcToken.decimals), ...amounts],
                state,
              );
              const ret: PoolPrices<PlatypusData> = {
                prices,
                unit,
                data: {
                  pool: poolAddress,
                },
                poolAddresses: [poolAddress],
                exchange: this.dexKey,
                gasCost: 260 * 1000,
                poolIdentifier: this.getPoolIdentifier(poolAddress),
              };
              return ret;
            })(this.eventPools![poolAddress]),
          ),
      )
    ).filter((p): p is PoolPrices<PlatypusData> => !!p);
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() couls be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: PlatypusData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: data.pool,
      payload: '0x',
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
    data: PlatypusData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      isETHAddress(srcToken)
        ? Platypus.avaxPoolInterface.encodeFunctionData('swapFromETH', [
            destToken,
            1,
            this.augustusAddress,
            this.getDeadline(),
          ])
        : isETHAddress(destToken)
        ? Platypus.avaxPoolInterface.encodeFunctionData('swapToETH', [
            srcToken,
            srcAmount,
            1,
            this.augustusAddress,
            this.getDeadline(),
          ])
        : Platypus.poolInterface.encodeFunctionData('swap', [
            srcToken,
            destToken,
            srcAmount,
            1,
            this.augustusAddress,
            this.getDeadline(),
          ]),
      data.pool,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    const blockNumber = await this.dexHelper.web3Provider.eth.getBlockNumber();
    await this.init(blockNumber);
    if (!this.cfgInfo)
      throw new Error(
        'updatePoolState: Platypus cfgInfo still null after init',
      );

    // All tokens are USD stablecoins so to estimate liquidity can just add
    // the cash balances of all the tokens
    const poolLiquidityUSD: { [poolAddress: string]: number } = {};
    let inputs: MultiCallInput[] = [];
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      for (const tokenAddress of this.cfgInfo.pools[poolAddress]
        .tokenAddresses) {
        inputs.push({
          target:
            this.cfgInfo.pools[poolAddress].tokens[tokenAddress].assetAddress,
          callData: Platypus.assetInterface.encodeFunctionData('cash'),
        });
      }
    }
    const returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    const usdPromises = [];
    let i = 0;
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      for (const tokenAddress of this.cfgInfo.pools[poolAddress]
        .tokenAddresses) {
        usdPromises.push(
          this.dexHelper.getTokenUSDPrice(
            {
              address: tokenAddress,
              decimals:
                this.cfgInfo.pools[poolAddress].tokens[tokenAddress]
                  .tokenDecimals,
            },
            BigInt(
              Platypus.assetInterface
                .decodeFunctionResult('cash', returnData[i++])[0]
                .toString(),
            ),
          ),
        );
      }
    }
    const usdValues = await Promise.all(usdPromises);
    i = 0;
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      poolLiquidityUSD[poolAddress] = 0;
      for (const tokenAddress of this.cfgInfo.pools[poolAddress]
        .tokenAddresses) {
        poolLiquidityUSD[poolAddress] += usdValues[i++];
      }
    }
    this.poolLiquidityUSD = poolLiquidityUSD;
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.cfgInfo || !this.poolLiquidityUSD) await this.updatePoolState();
    tokenAddress = tokenAddress.toLowerCase();
    const pools = this.cfgInfo!.poolAddresses.filter(
      poolAddress => !!this.cfgInfo!.pools[poolAddress].tokens[tokenAddress],
    );
    pools.sort((a, b) => this.poolLiquidityUSD![b] - this.poolLiquidityUSD![a]);
    return pools.slice(0, limit).map(poolAddress => ({
      exchange: this.dexKey,
      address: poolAddress,
      connectorTokens: this.cfgInfo!.pools[poolAddress].tokenAddresses.filter(
        t => t !== tokenAddress,
      ).map(t => ({
        decimals: this.cfgInfo!.pools[poolAddress].tokens[t].tokenDecimals,
        address: t,
      })),
      liquidityUSD: this.poolLiquidityUSD![poolAddress],
    }));
  }
}
