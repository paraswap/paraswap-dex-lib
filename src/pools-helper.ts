import { LoggerConstructor, PoolLiquidity, Logger, Address } from './types';
import { DexAdapterService } from './dex';

export class PoolsHelper {
  logger: Logger;

  constructor(
    protected dexAdapterService: DexAdapterService,
    loggerConstructor: LoggerConstructor,
  ) {
    this.logger = loggerConstructor(`PoolsHelper_${dexAdapterService.network}`);
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
      return await dex.getTopPoolsForToken(tokenAddress, count);
    } catch (e) {
      this.logger.error(`getTopPools_${dexKey}`, e);
      return [];
    }
  }

  async updateDexPoolState(dexKey: string) {
    try {
      const dexInstance = this.dexAdapterService.getDexByKey(dexKey);
      if (!dexInstance.updatePoolState) return;

      return await dexInstance.updatePoolState();
    } catch (e) {
      this.logger.error('Error_updateDexPoolState:', e);
    }
  }

  async updateAllPoolState(dexKeys: string[]) {
    return await Promise.all(dexKeys.map(key => this.updateDexPoolState(key)));
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
