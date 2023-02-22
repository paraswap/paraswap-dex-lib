import _ from 'lodash';
import { Logger } from 'log4js';
import { Contract } from 'web3-eth-contract';
import { blockAndTryAggregate } from '../utils';

export type MultiResult<T> = {
  success: boolean;
  returnData: T;
};

export type MultiWrapperResult<T> = {
  blockNumber: number;
  results: MultiResult<T>[];
};

export type MultiCallParams<T> = {
  target: string;
  callData: string;
  decodeFunction: (str: MultiResult<string> | string) => T;
  cb?: (data: T) => void;
};

export class MultiWrapper {
  readonly defaultBatchSize: number;

  /* eslint-disable-next-line */
  constructor(private multi: Contract, private logger: Logger) {
    this.defaultBatchSize = 500;
  }

  async aggregate<T>(
    calls: MultiCallParams<T>[],
    blockNumber?: number | string,
    batchSize: number = this.defaultBatchSize,
  ): Promise<T[]> {
    const aggregatedResult = await Promise.all(
      _.chunk(calls, batchSize).map(async batch =>
        this.multi.methods.aggregate(batch).call(undefined, blockNumber),
      ),
    );

    let globalInd = 0;
    const resultsUndecoded: string[] = new Array(calls.length);
    for (const res of aggregatedResult) {
      for (const element of res.returnData) {
        resultsUndecoded[globalInd++] = element;
      }
    }

    const results: T[] = new Array(resultsUndecoded.length);
    for (const [i, undecodedElement] of resultsUndecoded.entries()) {
      results[i] = calls[i].decodeFunction(undecodedElement);
      calls[i].cb?.(results[i]);
    }

    return results;
  }

  async tryAggregate<T>(
    mandatory: boolean,
    calls: MultiCallParams<T>[],
    blockNumber: number | 'latest' = 'latest',
    batchSize: number = this.defaultBatchSize,
    reportFails: boolean = true,
  ): Promise<MultiWrapperResult<T>> {
    if (calls.length === 0) {
      return {
        blockNumber: 0,
        results: [],
      };
    }

    const allCalls = new Array(Math.ceil(calls.length / batchSize));
    for (let i = 0; i < calls.length; i += batchSize) {
      const batch = calls.slice(i, i + batchSize);
      allCalls[Math.floor(i / batchSize)] = batch;
    }

    const aggregatedResult = await Promise.all(
      allCalls.map(batch =>
        blockAndTryAggregate(mandatory, this.multi, batch, blockNumber),
      ),
    );

    let globalInd = 0;
    const resultsUndecoded: MultiResult<string>[] = new Array(calls.length);

    let maxBlockNumber = aggregatedResult[0].blockNumber;
    for (const res of aggregatedResult) {
      if (maxBlockNumber < res.blockNumber) {
        this.logger.warn(
          'race-condition: Blocks between batches are different',
        );
      }
      for (const element of res.results) {
        resultsUndecoded[globalInd++] = element;
      }
    }

    const results: MultiResult<T>[] = new Array(resultsUndecoded.length);
    for (const [i, undecodedElement] of resultsUndecoded.entries()) {
      if (!undecodedElement.success) {
        if (reportFails) {
          this.logger.error(
            `Multicall request number ${i} for ${calls[i].target} failed`,
          );
        }

        results[i] = {
          success: false,
        } as MultiResult<T>;
        continue;
      }

      results[i] = {
        success: true,
        returnData: calls[i].decodeFunction(undecodedElement.returnData),
      } as MultiResult<T>;

      calls[i].cb?.(results[i].returnData);
    }

    return {
      blockNumber: maxBlockNumber,
      results,
    };
  }
}
