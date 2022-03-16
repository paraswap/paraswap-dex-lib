import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { SimpleExchange } from '../simple-exchange';
import {
  BalancerData,
  BalancerFunctions,
  BalancerParam,
  DexParams,
  OptimizedBalancerData,
} from './types';
import { Interface } from '@ethersproject/abi';
import { Network, SwapSide } from '../../constants';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
  TxInfo,
} from '../../types';
import { Adapters, Config } from './config';
import { Logger } from 'log4js';
import { BalancerPools, typecastReadOnlyPool } from './pools';
import BalancerABI from '../../abi/balancer-v1/Balancer.abi.json';
import { getDexKeysWithNetwork, isETHAddress, wrapETH } from '../../utils';
import { interpolate } from '../utils';
import { Pool as OldPool } from '@balancer-labs/sor/dist/types';
import _ from '../../../../paraswap-api/node_modules/@types/lodash';

const SETUP_RETRY_TIMEOUT = 1000 * 60 * 5; // 5 mins
const BALACER_SWAP_GASCOST = 120 * 1000;
const BALNCER_CHUNKS = 10;

export class Balancer
  extends SimpleExchange
  implements IDex<BalancerData, BalancerParam, OptimizedBalancerData>
{
  eventPools: BalancerPools;
  exchangeProxy: Address = '0x6317c5e82a06e1d8bf200d21f4510ac2c038ac81';
  exchangeRouterInterface: Interface;
  minConversionRate = '1';
  logger: Logger;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(Config);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected config: DexParams = Config[dexKey][network],
    protected adapters = Adapters[network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);

    this.eventPools = new BalancerPools(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );

    this.exchangeRouterInterface = new Interface(BalancerABI);
  }

  hasConstantPriceLargeAmounts: boolean = false;

  getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] {
    return this.adapters[side];
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedBalancerData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { swaps } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          'swaps[]': {
            pool: 'address',
            tokenInParam: 'uint',
            tokenOutParam: 'uint',
            maxPrice: 'uint',
          },
        },
      },
      { swaps },
    );

    return {
      targetExchange: data.exchangeProxy,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedBalancerData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { swaps } = data;

    if (side === SwapSide.BUY) {
      // Need to adjust the swap input params to match the adjusted srcAmount
      const _srcAmount = BigInt(srcAmount);
      const totalInParam = swaps.reduce(
        (acc, swap) => acc + BigInt(swap.tokenInParam),
        BigInt(0),
      );
      swaps.forEach(swap => {
        swap.tokenInParam = (
          (BigInt(swap.tokenInParam) * _srcAmount) /
          totalInParam
        ).toString();
      });
    }

    const [swapFunction, swapFunctionParam] = ((): [
      swapFunction: string,
      swapFunctionParam: BalancerParam,
    ] => {
      if (side === SwapSide.SELL) {
        if (isETHAddress(srcToken))
          return [
            BalancerFunctions.batchEthInSwapExactIn,
            [swaps, destToken, destAmount],
          ];

        if (isETHAddress(destToken))
          return [
            BalancerFunctions.batchEthOutSwapExactIn,
            [swaps, srcToken, srcAmount, destAmount],
          ];

        return [
          BalancerFunctions.batchSwapExactIn,
          [swaps, srcToken, destToken, srcAmount, destAmount],
        ];
      } else {
        if (isETHAddress(srcToken))
          return [BalancerFunctions.batchEthInSwapExactOut, [swaps, destToken]];
        if (isETHAddress(destToken))
          return [
            BalancerFunctions.batchEthOutSwapExactOut,
            [swaps, srcToken, srcAmount],
          ];

        return [
          BalancerFunctions.batchSwapExactOut,
          [swaps, srcToken, destToken, srcAmount],
        ];
      }
    })();

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParam,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.exchangeProxy,
    );
  }

  async getPoolPrices(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    unitVolume: bigint,
    exchangeProxy: Address,
    pool: OldPool,
  ): Promise<PoolPrices<BalancerData> | null> {
    try {
      let unit = await this.eventPools.getPoolPrices(pool, side, unitVolume);

      const _width = Math.floor((amounts.length - 1) / BALNCER_CHUNKS);
      const _amounts = Array.from(Array(BALNCER_CHUNKS).keys()).map(
        i => amounts[(i + 1) * _width],
      );

      const _prices = await Promise.all(
        _amounts.map(a => this.eventPools.getPoolPrices(pool, side, a)),
      );

      const prices = interpolate(_amounts, _prices, amounts, side);

      return {
        prices,
        unit,
        data: {
          pool: pool.id,
          exchangeProxy,
        },
        poolAddresses: [pool.id],
        exchange: 'Balancer',
        poolIdentifier: `Balancer_${pool.id}`,
        gasCost: BALACER_SWAP_GASCOST,
      };
    } catch (e) {
      this.logger.error(`Error_getPoolPrices: ${pool.id}`, e);
      return null;
    }
  }

  allocPools(_from: Token, _to: Token, limitPools?: string[]) {
    const from = wrapETH(_from, this.network);
    const to = wrapETH(_to, this.network);

    const state = this.eventPools.getStaleState();
    if (!state) {
      if (this.eventPools.isFetching)
        this.logger.error(
          'Error_allocPools: Pools state fetching still in process',
        );
      else this.logger.error('Error_allocPools: GetStaleState returned null');
      return;
    }

    const pools = Object.values(state).map(typecastReadOnlyPool);

    this.eventPools.allocPools(from, to, pools, limitPools);
  }

  async getPricesVolume(
    _from: Token,
    _to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<ExchangePrices<BalancerData> | null> {
    try {
      const from = wrapETH(_from, this.network);
      const to = wrapETH(_to, this.network);

      let state = await this.eventPools.getState(blockNumber);
      let isStale = false;

      if (!state) {
        if (this.eventPools.isFetching) {
          this.logger.error(
            'Error_getPrices: Pools state fetching still in process',
          );
          return null;
        } else {
          state = this.eventPools.getStaleState();
          if (!state) {
            this.logger.error(
              'Error_getPrices: Neither updated nor stale state found',
            );
            return null;
          }
          isStale = true;
          this.logger.warn('Warning_getPrices: Stale state being used');
        }
      }

      const unitVolume = BigInt(
        10 ** (side === SwapSide.SELL ? from : to).decimals,
      );
      const pools = Object.values(state).map(typecastReadOnlyPool);
      let minBalance = amounts[amounts.length - 1];

      if (unitVolume > minBalance) minBalance = unitVolume;
      let topPools = await this.eventPools.getTopPools(
        from,
        to,
        side,
        pools,
        minBalance,
        isStale,
        blockNumber,
        limitPools,
      );
      if (!topPools || !topPools.length) return null;

      const rates = (
        await Promise.all(
          topPools.map(p =>
            this.getPoolPrices(
              from,
              to,
              amounts,
              side,
              unitVolume,
              this.exchangeProxy,
              p,
            ),
          ),
        )
      ).filter(r => !!r) as PoolPrices<BalancerData>[];

      return rates;
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPrices: Aurelius block manager not yet instantiated`,
        );
      this.logger.error('Error_getPrices:', e);
      return null;
    }
    return null;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    const query = `
      query ($tokens: [Bytes!], $count: Int) {
        pools (first: $count, orderBy: liquidity, orderDirection: desc, where: {tokensList_contains: $tokens, active: true, publicSwap: true, liquidity_gt: 0}) {
            id
            liquidity
            tokens {
                address
                decimals
              }
            }
      }
    `;

    const { data } = await this.dexHelper.httpRequest.post(
      this.config.subgraphURL,
      {
        query,
        variables: { token: tokenAddress.toLowerCase(), count },
      },
    );

    if (!(data && data.pools))
      throw new Error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );

    const pools = _.map(data.pools, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: pool.tokens.reduce((acc, { decimals, address }) => {
        if (address.toLowerCase() != tokenAddress.toLowerCase())
          acc.push({ decimals, address: address.toLowerCase() });
        return acc;
      }, []),
      liquidityUSD: parseFloat(pool.liquidity),
    }));

    return pools;
  }
}
