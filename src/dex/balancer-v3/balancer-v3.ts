import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { BalancerV3Data, PoolState, PoolStateMap } from './types';
import { SimpleExchange } from '../simple-exchange';
import { BalancerV3Config, Adapters } from './config';
import { BalancerV3EventPool } from './balancer-v3-pool';
import { NumberAsString } from '@paraswap/core';
import { SwapKind } from '@balancer-labs/balancer-maths';
import { Interface } from '@ethersproject/abi';
import { balancerRouterAbi } from './abi/balancerRouter';
import { extractReturnAmountPosition } from '../../executor/utils';

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P];
};

export class BalancerV3 extends SimpleExchange implements IDex<BalancerV3Data> {
  protected eventPools: BalancerV3EventPool;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: vault can handle native
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BalancerV3Config);

  logger: Logger;
  balancerRouter: Interface;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new BalancerV3EventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
    this.balancerRouter = new Interface(balancerRouterAbi);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.eventPools.initialize(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _from = this.dexHelper.config.wrapETH(srcToken);
    const _to = this.dexHelper.config.wrapETH(destToken);
    const poolState = this.eventPools.getState(blockNumber);
    if (poolState === null) return [];
    return this.findPoolAddressesWithTokens(
      poolState,
      _from.address,
      _to.address,
    );
  }

  findPoolAddressesWithTokens(
    pools: DeepReadonly<PoolStateMap>,
    tokenA: string,
    tokenB: string,
  ): string[] {
    return Object.entries(pools)
      .filter(([, poolState]) => {
        return (
          poolState.tokens.includes(tokenA) && poolState.tokens.includes(tokenB)
        );
      })
      .map(([address]) => address);
  }

  /**
   * Filter pools that have tokens from/to and are in limitPool list
   * @param pools
   * @param from
   * @param to
   * @param limitPools
   * @returns Array of PoolState
   */
  filterPools(
    pools: DeepReadonly<PoolStateMap>,
    from: string,
    to: string,
    limitPools?: string[],
  ): PoolState[] {
    return Object.entries(pools)
      .filter(([address, poolState]) => {
        const hasRequiredTokens =
          poolState.tokens.includes(from) && poolState.tokens.includes(to);
        const isAllowedPool = !limitPools || limitPools.includes(address);
        return hasRequiredTokens && isAllowedPool;
      })
      .map(([_, poolState]) => poolState as DeepMutable<typeof poolState>);
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
  ): Promise<null | ExchangePrices<BalancerV3Data>> {
    try {
      const _from = this.dexHelper.config.wrapETH(srcToken);
      const _to = this.dexHelper.config.wrapETH(destToken);
      if (_from.address === _to.address) {
        return null;
      }

      // get up to date pools and state
      const allPoolState = this.eventPools.getState(blockNumber);
      if (allPoolState === null) {
        this.logger.error(`getState returned null`);
        return null;
      }

      // filter for pools with tokens and to only use limit pools
      const allowedPools = this.filterPools(
        allPoolState,
        _from.address,
        _to.address,
        limitPools,
      );

      if (!allowedPools.length) return null;

      const swapKind =
        side === SwapSide.SELL ? SwapKind.GivenIn : SwapKind.GivenOut;
      const tokenIn = _from.address;
      const tokenOut = _to.address;

      // Gets the single unit amount based off token decimals, e.g. for USDC its 1e6
      const unitAmount = getBigIntPow(
        (side === SwapSide.SELL ? _from : _to).decimals,
      );

      const poolPrices: ExchangePrices<BalancerV3Data> = [];
      // For each pool we calculate swap result using balancer maths
      for (let i = 0; i < allowedPools.length; i++) {
        const pool = {
          ...allowedPools[i],
          // TODO - Remove mapping once maths updated to same poolType convention
          poolType: this.mapToPoolType(allowedPools[i].poolType),
        };

        try {
          // This is the max amount the pool can swap
          const maxSwapAmount = this.eventPools.getMaxSwapAmount(
            pool,
            tokenIn,
            tokenOut,
            swapKind,
          );

          let unit = 0n;
          if (unitAmount < maxSwapAmount)
            unit = this.eventPools.getSwapResult(
              pool,
              unitAmount,
              tokenIn,
              tokenOut,
              swapKind,
            );

          const poolExchangePrice: PoolPrices<BalancerV3Data> = {
            prices: new Array(amounts.length).fill(0n),
            unit,
            data: {
              poolAddress: pool.address,
            },
            exchange: this.dexKey,
            gasCost: 1, // TODO - this will be updated once final profiles done
            poolAddresses: [pool.address],
            poolIdentifier: `${this.dexKey}_${pool.address}`,
          };

          for (let j = 0; j < amounts.length; j++) {
            if (amounts[j] < maxSwapAmount) {
              // Uses balancer maths to calculate swap
              poolExchangePrice.prices[j] = this.eventPools.getSwapResult(
                pool,
                amounts[j],
                tokenIn,
                tokenOut,
                swapKind,
              );
            }
          }
          poolPrices.push(poolExchangePrice);
        } catch (err) {
          this.logger.error(`error fetching prices for pool`);
          this.logger.error(err);
        }
      }

      return poolPrices;
    } catch (err) {}
    return null;
  }

  private mapToPoolType(apiPoolType: string): string {
    if (apiPoolType === 'STABLE') return 'Stable';
    else if (apiPoolType === 'WEIGHTED') return 'Weighted';
    else return apiPoolType;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<BalancerV3Data>,
  ): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BalancerV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    console.log(`!!!!!!!!!!!! getAdapterParam is being hit !!!!!!`);
    // TODO: complete me!
    const { poolAddress } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange:
        BalancerV3Config.BalancerV3[this.network].balancerRouterAddress,
      payload,
      networkFee: '0',
    };
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: BalancerV3Data,
    side: SwapSide,
  ): DexExchangeParam {
    if (side === SwapSide.SELL) {
      const exchangeData = this.balancerRouter.encodeFunctionData(
        'swapSingleTokenExactIn',
        [
          data.poolAddress,
          srcToken,
          destToken,
          srcAmount,
          '0', // This should be limit for min amount out. Assume this is set elsewhere via Paraswap contract.
          MAX_UINT256,
          this.needWrapNative, // TODO vault can handle native assets
          '0x',
        ],
      );

      return {
        needWrapNative: this.needWrapNative,
        dexFuncHasRecipient: false,
        exchangeData,
        // This router handles single swaps
        targetExchange:
          BalancerV3Config.BalancerV3[this.network].balancerRouterAddress,
        returnAmountPos: extractReturnAmountPosition(
          this.balancerRouter,
          'swapSingleTokenExactIn',
        ),
      };
    } else {
      const exchangeData = this.balancerRouter.encodeFunctionData(
        'swapSingleTokenExactOut',
        [
          data.poolAddress,
          srcToken,
          destToken,
          srcAmount,
          MAX_UINT256, // This should be limit for max amount in. Assume this is set elsewhere via Paraswap contract.
          MAX_UINT256,
          this.needWrapNative, // TODO vault can handle native assets
          '0x',
        ],
      );

      return {
        needWrapNative: this.needWrapNative,
        dexFuncHasRecipient: false,
        exchangeData,
        // Single swaps are submitted via Balancer Router
        targetExchange:
          BalancerV3Config.BalancerV3[this.network].balancerRouterAddress,
        returnAmountPos: extractReturnAmountPosition(
          this.balancerRouter,
          'swapSingleTokenExactOut',
        ),
      };
    }
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
    //TODO: complete me!
    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
