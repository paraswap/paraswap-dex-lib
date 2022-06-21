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
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  DexParams,
  PlatypusData,
  PlatypusConfigInfo,
  PlatypusPoolState,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { PlatypusConfig, Adapters } from './config';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { PlatypusPool } from './pool';
import { BI_POWS } from '../../bigint-constants';
import ERC20ABI from '../../abi/erc20.json';
import PoolABI from '../../abi/platypus/pool.json';
import AssetABI from '../../abi/platypus/asset.json';
import OracleABI from '../../abi/platypus/oracle.json';

const ETH_UNIT = BI_POWS[18];
const WAD = BI_POWS[18];
const RAY = BI_POWS[27];

function wmul(x: bigint, y: bigint): bigint {
  return (x * y + WAD / 2n) / WAD;
}

function wdiv(x: bigint, y: bigint): bigint {
  return (x * WAD + y / 2n) / y;
}

function rmul(x: bigint, y: bigint): bigint {
  return (x * y + RAY / 2n) / RAY;
}

function rpow(x: bigint, n: bigint): bigint {
  let z = n % 2n !== 0n ? x : RAY;

  for (n /= 2n; n !== 0n; n /= 2n) {
    x = rmul(x, x);

    if (n % 2n !== 0n) {
      z = rmul(z, x);
    }
  }

  return z;
}

function slippageFunc(
  k: bigint,
  n: bigint,
  c1: bigint,
  xThreshold: bigint,
  x: bigint,
): bigint {
  if (x < xThreshold) {
    return c1 - x;
  } else {
    return wdiv(k, (rpow((x * RAY) / WAD, n) * WAD) / RAY);
  }
}

function calcSlippage(
  k: bigint,
  n: bigint,
  c1: bigint,
  xThreshold: bigint,
  cash: bigint,
  liability: bigint,
  cashChange: bigint,
  addCash: boolean,
): bigint {
  const covBefore = wdiv(cash, liability);
  let covAfter: bigint;
  if (addCash) {
    covAfter = wdiv(cash + cashChange, liability);
  } else {
    covAfter = wdiv(cash - cashChange, liability);
  }
  if (covBefore === covAfter) {
    return 0n;
  }

  const slippageBefore = slippageFunc(k, n, c1, xThreshold, covBefore);
  const slippageAfter = slippageFunc(k, n, c1, xThreshold, covAfter);

  if (covBefore > covAfter) {
    return wdiv(slippageAfter - slippageBefore, covBefore - covAfter);
  } else {
    return wdiv(slippageBefore - slippageAfter, covAfter - covBefore);
  }
}

function calcSwappingSlippage(si: bigint, sj: bigint): bigint {
  return WAD + si - sj;
}

function calcHaircut(amount: bigint, rate: bigint): bigint {
  return wmul(amount, rate);
}

export class Platypus extends SimpleExchange implements IDex<PlatypusData> {
  static readonly erc20Interface = new Interface(ERC20ABI);
  static readonly poolInterface = new Interface(PoolABI);
  static readonly assetInterface = new Interface(AssetABI);
  static readonly oracleInterface = new Interface(OracleABI);

  protected config: DexParams;
  protected cfgInfo?: PlatypusConfigInfo;
  protected poolLiquidityUSD?: { [poolAddress: string]: number };

  protected eventPools?: { [poolAddress: string]: PlatypusPool };

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(PlatypusConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network], // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.config = PlatypusConfig[dexKey][network];
    this.logger = dexHelper.getLogger(`${dexKey}-${network}`);
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
        cfgInfo.poolAddresses.push(p.address.toLowerCase());
      }
    }
    let inputs: MultiCallInput[] = [];
    for (const poolAddress of cfgInfo.poolAddresses) {
      inputs.push({
        target: poolAddress,
        callData: Platypus.poolInterface.encodeFunctionData('getPriceOracle'),
      });
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
      const priceOracleAddress = Platypus.poolInterface
        .decodeFunctionResult('getPriceOracle', returnData[i++])[0]
        .toLowerCase();
      const tokenAddresses = Platypus.poolInterface
        .decodeFunctionResult('getTokenAddresses', returnData[i++])[0]
        .map((a: Address) => a.toLowerCase());
      cfgInfo.pools[poolAddress] = {
        priceOracleAddress,
        tokenAddresses,
        tokens: {},
      };
    }
    inputs = [];
    for (const poolAddress of cfgInfo.poolAddresses) {
      for (const tokenAddress of cfgInfo.pools[poolAddress].tokenAddresses) {
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
        inputs.push({
          target: cfgInfo.pools[poolAddress].priceOracleAddress,
          callData: Platypus.oracleInterface.encodeFunctionData(
            'getSourceOfAsset',
            [tokenAddress],
          ),
        });
      }
    }
    returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    i = 0;
    for (const poolAddress of cfgInfo.poolAddresses) {
      for (const tokenAddress of cfgInfo.pools[poolAddress].tokenAddresses) {
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
        const proxyAddress = Platypus.oracleInterface
          .decodeFunctionResult('getSourceOfAsset', returnData[i++])[0]
          .toLowerCase();
        cfgInfo.pools[poolAddress].tokens[tokenAddress] = {
          tokenSymbol,
          tokenDecimals,
          assetAddress,
          chainlink: {
            proxyAddress,
            aggregatorAddress: '',
          },
        };
      }
    }
    inputs = [];
    for (const poolAddress of cfgInfo.poolAddresses) {
      for (const tokenAddress of cfgInfo.pools[poolAddress].tokenAddresses) {
        inputs.push(
          ChainLinkSubscriber.getReadAggregatorMultiCallInput(
            cfgInfo.pools[poolAddress].tokens[tokenAddress].chainlink
              .proxyAddress,
          ),
        );
      }
    }
    returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    i = 0;
    for (const poolAddress of cfgInfo.poolAddresses) {
      for (const tokenAddress of cfgInfo.pools[poolAddress].tokenAddresses) {
        cfgInfo.pools[poolAddress].tokens[
          tokenAddress
        ].chainlink.aggregatorAddress = ChainLinkSubscriber.readAggregator(
          returnData[i++],
        ).toLowerCase();
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
        'initializePricing: Platypus cfgInfo still null after init',
      );
    const eventPools: { [poolAddress: string]: PlatypusPool } = {};
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      const pool = new PlatypusPool(
        this.dexKey,
        this.network,
        this.config.pools.find(
          p => p.address.toLowerCase() === poolAddress,
        )!.name,
        poolAddress,
        this.cfgInfo.pools[poolAddress],
        this.dexHelper,
      );
      const state = await pool.generateState(blockNumber);
      pool.setState(state, blockNumber);
      this.dexHelper.blockManager.subscribeToLogs(
        pool,
        pool.addressesSubscribed,
        blockNumber,
      );
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
      srcToken.address.toLowerCase(),
      destToken.address.toLowerCase(),
    ).map(p => this.getPoolIdentifier(p));
  }

  protected computePrices(
    srcTokenAddress: Address,
    srcTokenDecimals: number,
    destTokenAddress: Address,
    destTokenDecimals: number,
    amounts: bigint[],
    state: PlatypusPoolState,
  ): bigint[] {
    const tokenAPrice = state.chainlink[srcTokenAddress].answer;
    const tokenBPrice = state.chainlink[destTokenAddress].answer;
    if (tokenBPrice > tokenAPrice) {
      if (
        ((tokenBPrice - tokenAPrice) * ETH_UNIT) / tokenBPrice >
        state.params.maxPriceDeviation
      ) {
        return Array(amounts.length).fill(0n);
      }
    } else {
      if (
        ((tokenAPrice - tokenBPrice) * ETH_UNIT) / tokenAPrice >
        state.params.maxPriceDeviation
      ) {
        return Array(amounts.length).fill(0n);
      }
    }
    return amounts.map(fromAmount => {
      const idealToAmount =
        (fromAmount * getBigIntPow(destTokenDecimals)) /
        getBigIntPow(srcTokenDecimals);
      if (state.asset[destTokenAddress].cash < idealToAmount) return 0n;
      const slippageFrom = calcSlippage(
        state.params.slippageParamK,
        state.params.slippageParamN,
        state.params.c1,
        state.params.xThreshold,
        state.asset[srcTokenAddress].cash,
        state.asset[srcTokenAddress].liability,
        fromAmount,
        true,
      );
      const slippageTo = calcSlippage(
        state.params.slippageParamK,
        state.params.slippageParamN,
        state.params.c1,
        state.params.xThreshold,
        state.asset[destTokenAddress].cash,
        state.asset[destTokenAddress].liability,
        idealToAmount,
        false,
      );
      const swappingSlippage = calcSwappingSlippage(slippageFrom, slippageTo);
      const toAmount = wmul(idealToAmount, swappingSlippage);
      const haircut = calcHaircut(toAmount, state.params.haircutRate);
      return toAmount - haircut;
    });
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
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
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
            (async () => {
              let state = this.eventPools![poolAddress].getState(blockNumber);
              if (!state) {
                state = await this.eventPools![poolAddress].generateState(
                  blockNumber,
                );
                this.eventPools![poolAddress].setState(state, blockNumber);
              }
              if (state.params.paused) return null;
              const [unit, ...prices] = this.computePrices(
                srcTokenAddress,
                this.cfgInfo!.pools[poolAddress].tokens[srcTokenAddress]
                  .tokenDecimals,
                destTokenAddress,
                this.cfgInfo!.pools[poolAddress].tokens[destTokenAddress]
                  .tokenDecimals,
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
            })(),
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
      Platypus.poolInterface.encodeFunctionData('swap', [
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
    const blockNumber = await this.dexHelper.provider.getBlockNumber();
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
