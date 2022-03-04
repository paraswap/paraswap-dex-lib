import {
  Address,
  LoggerConstructor,
  Logger,
  Token,
  PoolPrices,
  ExchangePrices,
  UnoptimizedRate,
} from './types';
import {
  SwapSide,
  SETUP_RETRY_TIMEOUT,
  FETCH_POOL_INDENTIFIER_TIMEOUT,
  FETCH_POOL_PRICES_TIMEOUT,
} from './constants';
import { DexAdapterService } from './dex';
import { IRouteOptimizer } from './dex/idex';

export class PricingHelper {
  logger: Logger;
  public optimizeRate: IRouteOptimizer<UnoptimizedRate>;

  constructor(
    protected dexAdapterService: DexAdapterService,
    loggerConstructor: LoggerConstructor,
  ) {
    this.logger = loggerConstructor(
      `PricingHelper_${dexAdapterService.network}`,
    );
    this.optimizeRate = (ur: UnoptimizedRate) =>
      this.dexAdapterService.routeOptimizers.reduce(
        (acc: UnoptimizedRate, fn: IRouteOptimizer<UnoptimizedRate>) => fn(acc),
        ur,
      );
  }

  private async initializeDex(dexKey: string, blockNumber: number) {
    try {
      const dexInstance = this.dexAdapterService.getDexByKey(dexKey);

      if (!dexInstance.initializePricing) return;

      return await dexInstance.initializePricing(blockNumber);
    } catch (e) {
      this.logger.error('Error_startListening:', e);
      setTimeout(
        () => this.initializeDex(dexKey, blockNumber),
        SETUP_RETRY_TIMEOUT,
      );
    }
  }

  public getAllDexKeys(): string[] {
    return this.dexAdapterService.getAllDexKeys();
  }

  public async initialize(blockNumber: number, dexKeys: string[]) {
    return await Promise.all(
      dexKeys.map(key => this.initializeDex(key, blockNumber)),
    );
  }

  public async getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
    dexKeys: string[],
    filterConstantPricePool: boolean = false,
  ): Promise<(string[] | null)[]> {
    return await Promise.all(
      dexKeys.map(key => {
        try {
          return new Promise<string[] | null>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`Timout`)),
              FETCH_POOL_INDENTIFIER_TIMEOUT,
            );
            const dexInstance = this.dexAdapterService.getDexByKey(key);

            if (
              filterConstantPricePool &&
              dexInstance.hasConstantPriceLargeAmounts
            )
              return null;

            dexInstance
              .getPoolIdentifiers(from, to, side, blockNumber)
              .then(resolve, reject)
              .finally(() => {
                clearTimeout(timer);
              });
          });
        } catch (e) {
          this.logger.error(`Error_${key}_getPoolIdentifiers:`, e);
          return [];
        }
      }),
    );
  }

  public async getPoolPrices(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    dexKeys: string[],
    limitPoolsMap: { [key: string]: string[] | null } | null,
  ): Promise<PoolPrices<any>[]> {
    const dexPoolPrices = await Promise.all(
      dexKeys.map(key => {
        try {
          const limitPools = limitPoolsMap ? limitPoolsMap[key] : null;

          if (limitPools && !limitPools.length) return [];

          return new Promise<PoolPrices<any>[] | null>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`Timout`)),
              FETCH_POOL_PRICES_TIMEOUT,
            );

            const dexInstance = this.dexAdapterService.getDexByKey(key);

            dexInstance
              .getPricesVolume(
                from,
                to,
                amounts,
                side,
                blockNumber,
                limitPools ? limitPools : undefined,
              )
              .then(resolve, reject)
              .finally(() => {
                clearTimeout(timer);
              });
          });
        } catch (e) {
          this.logger.error(`Error_${key}_getPoolPrices:`, e);
          return [];
        }
      }),
    );

    return dexPoolPrices
      .filter((x): x is ExchangePrices<any> => !!x)
      .flat() // flatten to get all the pools for the swap
      .filter(p => {
        // Pools should only return correct chunks
        if (p.prices.length !== amounts.length) {
          this.logger.error(
            `Error_getPoolPrices: ${p.exchange} returned prices with invalid chunks`,
          );
          return false;
        }

        if (p.prices.every(pi => pi === BigInt(0))) {
          return false;
        }
        return true;
      });
  }
}
