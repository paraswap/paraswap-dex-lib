import Web3EthAbi, { AbiCoder } from 'web3-eth-abi';
import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import { funcName } from '../../../utils';
import { MAX_ALLOWED_STATE_DELAY_MS } from '../constants';
import { PoolState } from '../types';

export type MulticallReturnedTypes = bigint | bigint[];

export abstract class BasePoolPolling {
  readonly CLASS_NAME = this.constructor.name;

  protected _poolState: PoolState | null = null;

  protected _stateLastUpdatedAt: number = 0;

  protected abiCoder = Web3EthAbi as unknown as AbiCoder;

  constructor(protected name: string, protected logger: Logger) {}

  protected _setState(state: PoolState, updateAt: number) {
    this._poolState = state;
    this._stateLastUpdatedAt = updateAt;
  }

  abstract setState(
    multiOutputs: MultiResult<MulticallReturnedTypes>[],
    updatedAt: number,
  ): void;

  abstract getStateMultiCalldata(): MultiCallParams<MulticallReturnedTypes>[];

  getState(): PoolState | null {
    if (
      this._poolState &&
      Date.now() - this._stateLastUpdatedAt < MAX_ALLOWED_STATE_DELAY_MS
    ) {
      return this._poolState;
    } else if (this._poolState) {
      this.logger.error(
        `${this.name} ${funcName()}: state is older than max allowed time`,
      );
    } else {
      this.logger.error(
        `${this.name} ${funcName()}: state was not initialized properly`,
      );
    }

    return null;
  }
}
