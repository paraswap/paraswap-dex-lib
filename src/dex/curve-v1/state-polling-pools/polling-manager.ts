import { MultiWrapper } from '../../../lib/multi-wrapper';
import { BasePoolPolling } from './base-pool-polling';

export class StatePollingManager {
  static async updatePoolsInBatch(
    multiWrapper: MultiWrapper,
    pools: BasePoolPolling[],
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

    const result = await multiWrapper.tryAggregate(false, callDatas);
    const updatedAt = Date.now();

    let lastStart = 0;
    pools.map((p, i) => {
      p.setState(
        result.slice(lastStart, lastStart + poolResultDivider[i]),
        updatedAt,
      );
      lastStart += poolResultDivider[i];
    });
  }
}
