import { Logger } from 'log4js';
import { MultiWrapper } from '../../../lib/multi-wrapper';
import { PoolPollingBase } from './pool-polling-base';

/*
 * Since we are updating all pools state at once, I need some generalized iterator without state,
 * just to go for every pool, get multicall requests and apply them into new state
 */
export class StatePollingManager {
  static async updatePoolsInBatch(
    logger: Logger,
    network: number,
    multiWrapper: MultiWrapper,
    pools: PoolPollingBase[],
    blockNumber?: number,
  ) {
    if (pools.length === 0) {
      return;
    }

    const poolResultDivider = new Array<number>(pools.length).fill(0);
    const callDatas = pools
      .map((p, i) => {
        const poolCalldata = p.getStateMultiCalldata();
        poolResultDivider[i] = poolCalldata.length;
        return poolCalldata;
      })
      .flat();

    try {
      const result = await multiWrapper.tryAggregate(
        false,
        callDatas,
        blockNumber,
      );
      const updatedAt = Date.now();

      let lastStart = 0;
      pools.map((p, i) => {
        p.setState(
          result.slice(lastStart, lastStart + poolResultDivider[i]),
          updatedAt,
        );
        lastStart += poolResultDivider[i];
      });
    } catch (e) {
      logger.error(
        `Network ${network}: Failed to update state for pools: ${pools
          .map(p => p.address)
          .join(',')}: `,
        e,
      );
    }
  }
}
