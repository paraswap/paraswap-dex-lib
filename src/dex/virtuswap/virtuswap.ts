import { AsyncOrSync, assert } from 'ts-essentials';
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
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { BI_MAX_UINT256 } from '../../bigint-constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper';
import { PoolState, VirtuSwapData } from './types';
import {
  getLocalDeadlineAsFriendlyPlaceholder,
  SimpleExchange,
} from '../simple-exchange';
import { VirtuSwapConfig, Adapters } from './config';
import { VirtuSwapFactory } from './virtuswap-factory';
import { VirtuSwapEventPool } from './virtuswap-pool';
import vRouterABI from '../../abi/virtuswap/vRouter.json';
import { computeAddress } from './lib/PoolAddress';
import {
  getAmountIn,
  getAmountOut,
  getMaxVirtualTradeAmountRtoN,
  getVirtualPool,
  getVirtualPools,
  sortBalances,
} from './lib/vSwapLibrary';

export class VirtuSwap extends SimpleExchange implements IDex<VirtuSwapData> {
  static readonly vRouterInterface = new Interface(vRouterABI);
  protected factory: VirtuSwapFactory;
  protected pools: { [poolAddress: string]: VirtuSwapEventPool } = {};

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(VirtuSwapConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly vRouterIface: Interface = VirtuSwap.vRouterInterface,
    readonly vPairFactoryIface: Interface = VirtuSwapFactory.vPairFactoryInterface,
    readonly vPairIface: Interface = VirtuSwapEventPool.vPairInterface,
    protected config = VirtuSwapConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    this.factory = new VirtuSwapFactory(
      dexKey,
      network,
      dexHelper,
      this.logger,
      this.addPool.bind(this),
      config.factoryAddress,
      vPairFactoryIface,
    );
  }

  async initialize(blockNumber: number) {
    if (!this.factory.isInitialized) {
      await this.factory.initialize(blockNumber);
    }
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.initialize(blockNumber);

    assert(
      !!this.factory.getState(blockNumber),
      'initializePricing: factory state is not initialized',
    );
  }

  getPoolState(pool: Address, blockNumber: number) {
    return this.pools[pool]?.getState(blockNumber - 1) ?? null;
  }

  async addPool(pool: Address, blockNumber: number) {
    if (!this.pools[pool]) {
      this.pools[pool] = new VirtuSwapEventPool(
        this.dexKey,
        this.network,
        this.dexHelper,
        this.logger,
        this.config.isTimestampBased,
        pool,
        this.getPoolState.bind(this),
        this.vPairIface,
      );
      await this.pools[pool].initialize(blockNumber);
    }
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  computePoolAddress({ token0, token1 }: { token0: Address; token1: Address }) {
    return computeAddress(
      this.config.factoryAddress,
      token0,
      token1,
      this.config.initCode,
    );
  }

  async getVirtualPoolNumber(blockNumber: number): Promise<number> {
    if (!this.config.isTimestampBased) return blockNumber;

    const latestBlockNumber = await this.dexHelper.provider.getBlockNumber();
    if (blockNumber <= latestBlockNumber) {
      const block = await this.dexHelper.provider.getBlock(blockNumber);
      return block.timestamp;
    } else {
      this.logger.warn(
        `tryGetBlockTimestamp: trying to get block which is in the future: blockNumber=${blockNumber}, latestBlockNumber=${latestBlockNumber}`,
      );
      return Math.floor(new Date().getTime() / 1000); // fallback to current timestamp
    }
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. `${dexKey}_${poolAddress}` for real,
  // `${dexKey}_${jkPair}_${ikPair}` for virtual pools.
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const from = this.dexHelper.config.wrapETH(srcToken);
    const to = this.dexHelper.config.wrapETH(destToken);
    const [token0, token1] = [from, to].map(token =>
      token.address.toLowerCase(),
    );
    if (token0 === token1) return [];

    const poolAddress = this.computePoolAddress({ token0, token1 });

    const allPoolsStates = Object.values(this.pools)
      .map(pool => pool.getState(blockNumber))
      .filter(state => !!state) as PoolState[];

    try {
      const virtualPools = getVirtualPools(
        allPoolsStates,
        await this.getVirtualPoolNumber(blockNumber),
        token0,
        token1,
      ).map(
        vPool =>
          `${this.dexKey}_${this.computePoolAddress(
            vPool.jkPair,
          )}_${this.computePoolAddress(vPool.ikPair)}`,
      );

      return poolAddress
        ? [`${this.dexKey}_${poolAddress}`, ...virtualPools]
        : virtualPools;
    } catch (e: any) {
      this.logger.warn('getPoolIdentifiers: error on getVirtualPools', e);

      return poolAddress ? [`${this.dexKey}_${poolAddress}`] : [];
    }
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
  ): Promise<null | ExchangePrices<VirtuSwapData>> {
    const from = this.dexHelper.config.wrapETH(srcToken);
    const to = this.dexHelper.config.wrapETH(destToken);
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;

    const isSell = side === SwapSide.SELL;
    const unitAmount = getBigIntPow(isSell ? from.decimals : to.decimals);
    const getAmount = isSell ? getAmountOut : getAmountIn;

    const identifiers =
      limitPools?.filter(id => id.startsWith(this.dexKey)) ??
      (await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber));

    const pricesVolume = (
      await Promise.all(
        identifiers.map(async id => {
          const splittedId = id.split('_');
          switch (splittedId.length) {
            // poolAddress from `${dexKey}_${poolAddress}` for real pools
            case 2: {
              const poolAddress = splittedId[1];
              const poolState = this.getPoolState(poolAddress, blockNumber);
              if (!poolState) return null;

              const fee = poolState.fee;
              const [balance0, balance1] = sortBalances(
                from.address.toLowerCase(),
                poolState.token0.toLowerCase(),
                poolState.pairBalance0,
                poolState.pairBalance1,
              );

              return {
                prices: amounts.map(amount =>
                  getAmount(amount, balance0, balance1, fee),
                ),
                unit: getAmount(unitAmount, balance0, balance1, fee),
                data: {
                  isVirtual: false,
                  path: [from.address, to.address],
                },
                poolIdentifier: id,
                poolAddresses: [poolAddress],
                exchange: this.dexKey,
                gasCost: this.config.realPoolGasCost,
              };
            }
            // jkPair, ikPair from `${dexKey}_${jkPair}_${ikPair}` for virtual pools
            case 3: {
              const jkPair = splittedId[1];
              const ikPair = splittedId[2];
              const jkState = this.getPoolState(jkPair, blockNumber);
              if (!jkState) return null;

              const ikState = this.getPoolState(ikPair, blockNumber);
              if (!ikState) return null;

              try {
                const vPool = getVirtualPool(
                  jkState,
                  ikState,
                  await this.getVirtualPoolNumber(blockNumber),
                );
                const { balance0, balance1, fee } = vPool;

                // maxAmount is used to prevent reserve amount from going beyond pool threshold
                const maxAmount = getMaxVirtualTradeAmountRtoN(vPool);

                return {
                  prices: amounts.map(amount => {
                    if (isSell && amount > maxAmount) return 0n;
                    const price = getAmount(amount, balance0, balance1, fee);
                    if (!isSell && price > maxAmount) return BI_MAX_UINT256;
                    return price;
                  }),
                  unit: getAmount(unitAmount, balance0, balance1, fee),
                  data: {
                    isVirtual: true,
                    tokenOut: to.address,
                    commonToken: vPool.commonToken,
                    ikPair: ikPair,
                  },
                  poolIdentifier: id,
                  poolAddresses: [jkPair, ikPair],
                  exchange: this.dexKey,
                  gasCost: this.config.virtualPoolGasCost,
                };
              } catch (e) {
                this.logger.debug(
                  `getPricesVolume: error on getVirtualPool, jkPair=${jkPair}, ikPair=${ikPair}`,
                  e,
                );
                return null;
              }
            }
            default:
              return null;
          }
        }),
      )
    ).filter(prices => !!prices) as PoolPrices<VirtuSwapData>[];

    const lastIndex = amounts.length - 1;

    const sortFn = isSell
      ? (a: PoolPrices<VirtuSwapData>, b: PoolPrices<VirtuSwapData>) =>
          Number(b.prices[lastIndex] - a.prices[lastIndex])
      : (a: PoolPrices<VirtuSwapData>, b: PoolPrices<VirtuSwapData>) =>
          Number(a.prices[lastIndex] - b.prices[lastIndex]);

    return pricesVolume.sort(sortFn);
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<VirtuSwapData>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      (poolPrices.data.isVirtual
        ? // functionSelector
          CALLDATA_GAS_COST.wordNonZeroBytes(4) +
          // tokenOut address
          CALLDATA_GAS_COST.ADDRESS +
          // commonToken address
          CALLDATA_GAS_COST.ADDRESS +
          // ikPair address
          CALLDATA_GAS_COST.ADDRESS +
          // deadline
          CALLDATA_GAS_COST.TIMESTAMP
        : // struct size
          CALLDATA_GAS_COST.LENGTH_SMALL +
          // functionSelector
          CALLDATA_GAS_COST.wordNonZeroBytes(4) +
          // path0 address
          CALLDATA_GAS_COST.ADDRESS +
          // path1 address
          CALLDATA_GAS_COST.ADDRESS +
          // deadline
          CALLDATA_GAS_COST.TIMESTAMP)
    );
  }

  protected getRouterFunctionName(
    isVirtual: boolean,
    side: SwapSide,
    srcToken: Address,
    destToken: Address,
  ): string {
    const isSell = side === SwapSide.SELL;
    const isSwapFromNative = isETHAddress(srcToken);
    const isSwapToNative = isETHAddress(destToken);

    return `swap${isVirtual ? 'Reserve' : ''}${isSell ? 'Exact' : ''}${
      isSwapFromNative ? 'ETH' : 'Tokens'
    }For${isSell ? '' : 'Exact'}${isSwapToNative ? 'ETH' : 'Tokens'}`;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: string,
    destAmount: string,
    data: VirtuSwapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const deadline = getLocalDeadlineAsFriendlyPlaceholder();
    const functionName = this.getRouterFunctionName(
      data.isVirtual,
      side,
      srcToken,
      destToken,
    );

    const functionSelector = this.vRouterIface.getSighash(functionName);

    this.logger.debug('getAdapterParam:', {
      functionName,
      functionSelector,
    });

    const payload = data.isVirtual
      ? this.abiCoder.encodeParameter(
          {
            VirtuSwapVirtualPoolData: {
              functionSelector: 'bytes4',
              tokenOut: 'address',
              commonToken: 'address',
              ikPair: 'address',
              deadline: 'uint256',
            },
          },
          {
            functionSelector,
            tokenOut: data.tokenOut,
            commonToken: data.commonToken,
            ikPair: data.ikPair,
            deadline,
          },
        )
      : this.abiCoder.encodeParameter(
          {
            VirtuSwapRealPoolData: {
              functionSelector: 'bytes4',
              path0: 'address',
              path1: 'address',
              deadline: 'uint256',
            },
          },
          {
            functionSelector,
            path0: data.path[0],
            path1: data.path[1],
            deadline,
          },
        );

    return {
      targetExchange: this.config.router,
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  async getSimpleParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: string,
    destAmount: string,
    data: VirtuSwapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const isSell = side === SwapSide.SELL;
    const recipient = this.augustusAddress;
    const deadline = getLocalDeadlineAsFriendlyPlaceholder();
    const functionName = this.getRouterFunctionName(
      data.isVirtual,
      side,
      srcToken,
      destToken,
    );

    let values: any[];
    if (data.isVirtual) {
      const { tokenOut, commonToken, ikPair } = data;
      if (isSell) {
        values = [
          tokenOut,
          commonToken,
          ikPair,
          srcAmount,
          destAmount,
          recipient,
          deadline,
        ];
      } else {
        values = [
          tokenOut,
          commonToken,
          ikPair,
          destAmount,
          srcAmount,
          recipient,
          deadline,
        ];
      }
    } else {
      const { path } = data;
      if (isSell) {
        values = [path, srcAmount, destAmount, recipient, deadline];
      } else {
        values = [path, destAmount, srcAmount, recipient, deadline];
      }
    }

    const swapData: string = this.vRouterIface.encodeFunctionData(
      functionName,
      values,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.router,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    // virtual pools have smaller liquidity than real pools, so only real pools should be returned
    //TODO: complete me!
    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
