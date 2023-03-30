import { BytesLike } from 'ethers';
import _ from 'lodash';
import { Logger } from 'log4js';
import { Contract } from 'web3-eth-contract';
import { uint256DecodeToNumber } from './decoders';

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
  decodeFunction: (str: MultiResult<BytesLike> | BytesLike) => T;
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
  ): Promise<MultiResult<T>[]> {
    const _blockNumber = blockNumber === undefined ? 'latest' : blockNumber;

    const allCalls = new Array(Math.ceil(calls.length / batchSize));
    for (let i = 0; i < calls.length; i += batchSize) {
      const batch = calls.slice(i, i + batchSize);
      allCalls[Math.floor(i / batchSize)] = batch;
    }

    const aggregatedResult = await Promise.all(
      allCalls.map(batch =>
        this.multi.methods
          .tryAggregate(mandatory, batch)
          .call(undefined, _blockNumber),
      ),
    );

    let globalInd = 0;
    const resultsUndecoded: MultiResult<string>[] = new Array(calls.length);
    for (const res of aggregatedResult) {
      for (const element of res) {
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

    return results;
  }

  // I removed here batching because it may give inconsistent blockNumber
  // If we see that is a problem, we can add later
  async blockTryAggregateWithoutBatching<T>(
    mandatory: boolean,
    calls: MultiCallParams<T>[],
    requestedBlockNumber: number | 'latest' = 'latest',
    reportFails: boolean = true,
  ) {
    const blockNumberCall: MultiCallParams<number> = {
      target: this.multi.options.address,
      callData: this.multi.methods.getBlockNumber().encodeABI() as string,
      decodeFunction: uint256DecodeToNumber,
    };

    const callsWithBlockNumber: [
      ...MultiCallParams<T>[],
      MultiCallParams<number>,
    ] = [...calls, blockNumberCall];

    const results = await this.tryAggregate(
      mandatory,
      callsWithBlockNumber as MultiCallParams<T | number>[],
      requestedBlockNumber,
      callsWithBlockNumber.length,
      reportFails,
    );

    // We guaranteed previously that at least one call is contained
    const blockNumber = results.pop()!.returnData as number;

    return {
      blockNumber,
      results: results as MultiResult<T>[],
    };
  }
}
