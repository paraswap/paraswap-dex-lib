import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  Log,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { wrapETH, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  NerveData,
  PoolState,
  DexParams,
  EventPoolMappings,
  NotEventPoolMappings,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { NerveConfig, Adapters } from './config';
import { NerveEventPool } from './nerve-pool';

export class Nerve
  extends SimpleExchange
  implements IDex<PoolState, DexParams>
{
  protected eventPools: EventPoolMappings;

  protected notEventPools: NotEventPoolMappings;

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(NerveConfig);

  logger: Logger;

  static getIdentifier(dexKey: string, tokens: string[]) {
    const tokenSorted = tokens
      .sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1))
      .join('_');
    return `${dexKey}_${tokenSorted}`;
  }

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected poolConfigs = NerveConfig[dexKey][network].poolConfigs,
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
  }

  async initializePricing(blockNumber: number) {
    const allPoolKeys = Object.keys(Nerve.dexKeysWithNetwork);
    for (const poolKey of allPoolKeys) {
      const poolConfig = this.poolConfigs[poolKey];
      const poolIdentifier = Nerve.getIdentifier(this.dexKey, poolConfig.coins);

      // We don't support Metapool yet
      if (!poolConfig.isMetapool) {
        this.eventPools[poolIdentifier] = new NerveEventPool(
          this.dexKey,
          this.network,
          this.dexHelper,
          this.logger,
          poolKey,
          poolConfig,
        );
        // Generate first state for the blockNumber
        this.eventPools[poolIdentifier].setup(blockNumber);
      } else {
        this.notEventPools[poolIdentifier] = { config: poolConfig };
      }
    }
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] || null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const eventSupportedPools = Object.values(this.eventPools)
      .filter(pool => {
        return (
          pool.poolCoins.includes(srcToken.address) &&
          pool.poolCoins.includes(destToken.address)
        );
      })
      .map(pool => Nerve.getIdentifier(this.dexKey, pool.poolCoins));
    const otherPools = Object.values(this.notEventPools)
      .filter(pool => {
        return (
          pool.config.coins.includes(srcToken.address) &&
          pool.config.coins.includes(destToken.address)
        );
      })
      .map(({ config: poolConfig }) =>
        Nerve.getIdentifier(this.dexKey, poolConfig.coins),
      );
    return eventSupportedPools.concat(otherPools);
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
  ): Promise<null | ExchangePrices<NerveData>> {
    try {
      if (side === SwapSide.BUY) return null;

      const _srcToken = wrapETH(srcToken, this.network);
      const _destToken = wrapETH(destToken, this.network);

      if (
        _srcToken.address.toLowerCase() === _destToken.address.toLowerCase()
      ) {
        return null;
      }

      const poolIdentifier = Nerve.getIdentifier(this.dexKey, [
        _srcToken.address,
        _destToken.address,
      ]);

      if (limitPools && limitPools.every(p => p !== poolIdentifier))
        return null;

      // await this.batchCatchUpPairs([[from, to]], blockNumber);

      // const pairParam = await this.getPairOrderedParams(from, to, blockNumber);

      // if (!pairParam) return null;

      // const unitAmount = BigInt(
      //   10 ** (side == SwapSide.BUY ? to.decimals : from.decimals),
      // );
      // const unit =
      //   side == SwapSide.BUY
      //     ? await this.getBuyPricePath(unitAmount, [pairParam])
      //     : await this.getSellPricePath(unitAmount, [pairParam]);

      // const prices =
      //   side == SwapSide.BUY
      //     ? await Promise.all(
      //         amounts.map(amount => this.getBuyPricePath(amount, [pairParam])),
      //       )
      //     : await Promise.all(
      //         amounts.map(amount => this.getSellPricePath(amount, [pairParam])),
      //       );

      // // As uniswapv2 just has one pool per token pair
      // return [
      //   {
      //     prices: prices,
      //     unit: unit,
      //     data: {
      //       router: this.router,
      //       path: [from.address.toLowerCase(), to.address.toLowerCase()],
      //       factory: this.factoryAddress,
      //       initCode: this.initCode,
      //       feeFactor: this.feeFactor,
      //       pools: [
      //         {
      //           address: pairParam.exchange,
      //           fee: parseInt(pairParam.fee),
      //           direction: pairParam.direction,
      //         },
      //       ],
      //     },
      //     exchange: this.dexKey,
      //     poolIdentifier,
      //     gasCost: this.poolGasCost,
      //     poolAddresses: [pairParam.exchange],
      //   },
      // ];
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() couls be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedNerveData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
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
    data: OptimizedNerveData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!
  }
}
