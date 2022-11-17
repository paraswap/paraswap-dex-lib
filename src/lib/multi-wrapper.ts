import _ from 'lodash';
import { Logger } from 'log4js';
import { Contract } from 'web3-eth-contract';

export type MultiResult<T> = {
  success: boolean;
  returnData: T;
};

export type MultiCallParams<T> = {
  target: string;
  callData: string;
  decodeFunction: (str: MultiResult<string> | string) => T;
  cb?: (data: T) => void;
};

export class MultiWrapper {
  /* eslint-disable-next-line */
  constructor(private multi: Contract, private logger: Logger) {}

  async aggregate<T>(
    calls: MultiCallParams<T>[],
    blockNumber?: number | string,
    batchSize: number = 500,
  ): Promise<T[]> {
    const aggregatedResult = await Promise.all(
      _.chunk(calls, batchSize).map(async batch =>
        this.multi.methods.aggregate(batch).call(undefined, blockNumber),
      ),
    );

    let globalInd = 0;
    const results: string[] = new Array(calls.length);
    for (const res of aggregatedResult) {
      for (const element of res.returnData) {
        results[globalInd++] = element;
      }
    }

    return results.map((result: string, index: number) => {
      const requested = calls[index];
      const res = calls[index].decodeFunction(result);

      if (requested.cb) {
        requested.cb(res);
      }

      return res;
    });
  }

  async tryAggregate<T>(
    mandatory: boolean,
    calls: MultiCallParams<T>[],
    blockNumber?: number | string,
    batchSize: number = 500,
  ): Promise<MultiResult<T>[]> {
    const allCalls = new Array(Math.ceil(calls.length / batchSize));
    for (let i = 0; i < calls.length; i += batchSize) {
      const batch = calls.slice(i, i + batchSize);
      allCalls[Math.floor(i / batchSize)] = batch;
    }

    const aggregatedResult = await Promise.all(
      allCalls.map(batch =>
        this.multi.methods
          .tryAggregate(mandatory, batch)
          .call(undefined, blockNumber),
      ),
    );

    let globalInd = 0;
    const results: MultiResult<string>[] = new Array(calls.length);
    for (const res of aggregatedResult) {
      for (const element of res) {
        results[globalInd++] = element;
      }
    }

    return results.map((result: MultiResult<string>, index: number) => {
      const requested = calls[index];
      if (!result.success) {
        this.logger.error(
          `Multicall request number ${index} for ${requested.target} failed`,
        );
        return {
          success: false,
        } as MultiResult<T>;
      }

      const res = {
        success: true,
        returnData: calls[index].decodeFunction(result),
      } as MultiResult<T>;

      if (requested.cb) {
        requested.cb(res.returnData);
      }

      return res;
    });
  }
}
