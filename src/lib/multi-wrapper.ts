import { Logger } from 'log4js';
import * as _ from 'lodash';
import { Contract } from 'web3-eth-contract';

export type MultiResult<T> = {
  success: boolean;
  returnData: T;
};

export type MultiCallParams<T> = {
  target: string;
  callData: string;
  decodeFunction: (str: MultiResult<string>) => T;
  cb?: (data: T) => void;
};

export class MultiWrapper {
  /* eslint-disable-next-line */
  constructor(private multi: Contract, private logger: Logger) {}

  async tryAggregate<T>(
    mandatory: boolean,
    calls: MultiCallParams<T>[],
    blockNumber?: number | string,
    batchSize: number = 500,
  ): Promise<MultiResult<T>[]> {
    const allCalls = _.chunk(calls, batchSize);

    const aggregatedResult = await Promise.all(
      allCalls.map(batch =>
        this.multi.methods
          .tryAggregate(mandatory, batch)
          .call(undefined, blockNumber),
      ),
    );

    const results = aggregatedResult.reduce<MultiResult<string>[]>(
      (acc, res) => {
        acc.push(...res);
        return acc;
      },
      [],
    );

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

      try {
        const res = {
          success: true,
          returnData: calls[index].decodeFunction(result),
        } as MultiResult<T>;
      } catch (e) {
        console.log(e, requested);
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
