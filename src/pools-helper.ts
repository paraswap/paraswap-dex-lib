import {
  LoggerConstructor,
  PoolLiquidity,
  Logger,
  Token,
  Address,
} from './types';
import { DexAdapterService } from './dex';

export class PoolsHelper {
  logger: Logger;

  constructor(
    protected dexAdapterService: DexAdapterService,
    loggerConstructor: LoggerConstructor,
  ) {
    this.logger = loggerConstructor(`PoolsHelper_{dexAdapterService.network}`);
  }

  public getAllDexKeys(): string[] {
    return this.dexAdapterService.getAllDexKeys();
  }

  private async getTopPoolsDex(
    tokenAddress: Address,
    dexKey: string,
    count: number,
  ): Promise<PoolLiquidity[]> {
    try {
      const dex = this.dexAdapterService.getDexByKey(dexKey);
      return dex.getTopPoolsForToken(tokenAddress, count);
    } catch (e) {
      this.logger.error(`getTopPools_${dexKey}`, e);
      return [];
    }
  }

  public async getTopPools(
    tokenAddress: Address,
    dexKeys: string[],
    countPerDex: number,
  ): Promise<PoolLiquidity[]> {
    return (
      await Promise.all(
        dexKeys.map(key => this.getTopPoolsDex(tokenAddress, key, countPerDex)),
      )
    ).flat();
  }
}
