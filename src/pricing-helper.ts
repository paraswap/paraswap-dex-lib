import {
  Address,
  LoggerConstructor,
  Logger,
  Token,
  PoolPrices,
  ExchangePrices,
} from './types';
import {
  SwapSide,
  SETUP_RETRY_TIMEOUT,
  FETCH_POOL_INDENTIFIER_TIMEOUT,
  FETCH_POOL_PRICES_TIMEOUT,
} from './constants';
import { DexAdapterService } from './dex';

export class PricingHelper {
  logger: Logger;

  constructor(
    protected dexAdapterService: DexAdapterService,
    loggerConstructor: LoggerConstructor,
  ) {
    this.logger = loggerConstructor(
      `PricingHelper_${dexAdapterService.network}`,
    );
  }

  private async initializeDex(dexKey: string, blockNumber: number) {
    try {
      const dexInstace = this.dexAdapterService.getDexByKey(dexKey);

      if (!dexInstace.initializePricing) return;

      return await dexInstace.initializePricing(blockNumber);
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
            const dexInstace = this.dexAdapterService.getDexByKey(key);

            if (
              filterConstantPricePool &&
              dexInstace.hasConstantPriceLargeAmounts
            )
              return null;

            dexInstace
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

            const dexInstace = this.dexAdapterService.getDexByKey(key);

            dexInstace
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
