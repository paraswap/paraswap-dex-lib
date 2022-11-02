import Web3EthAbi, { AbiCoder } from 'web3-eth-abi';
import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import { funcName } from '../../../utils';
import { MAX_ALLOWED_STATE_DELAY_MS } from '../constants';
import { CurveV1FactoryData, PoolConstants, PoolState } from '../types';
import { Address } from 'paraswap-core';

export type MulticallReturnedTypes = bigint | bigint[];

export abstract class BasePoolPolling {
  readonly CLASS_NAME = this.constructor.name;

  readonly fullName: string;

  protected _poolState: PoolState | null = null;

  protected _stateLastUpdatedAt: number = 0;

  protected abiCoder = Web3EthAbi as unknown as AbiCoder;

  constructor(
    readonly logger: Logger,
    readonly dexKey: string,
    readonly implementationName: string,
    readonly poolIdentifier: string,
    readonly poolConstants: PoolConstants,
    readonly address: Address,
    readonly isMetaPool: boolean,
    readonly underlyingCoins: Address[],
    readonly isSrcFeeOnTransferSupported: boolean,
  ) {
    this.fullName = `${dexKey}-${this.CLASS_NAME}-${this.implementationName}-${this.address}`;
  }

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
        `${this.fullName} ${funcName()}: state is older than max allowed time`,
      );
    } else {
      this.logger.error(
        `${this.fullName} ${funcName()}: state was not initialized properly`,
      );
    }

    return null;
  }

  getPoolData(srcAddress: Address, destAddress: Address): CurveV1FactoryData {
    const iC = this.poolConstants.COINS.indexOf(srcAddress);
    const jC = this.poolConstants.COINS.indexOf(destAddress);

    if (iC !== -1 && jC !== -1) {
      return {
        exchange: this.address,
        i: iC,
        j: jC,
        underlyingSwap: false,
      };
    }

    if (this.isMetaPool) {
      const iU = this.underlyingCoins.indexOf(srcAddress);
      const jU = this.underlyingCoins.indexOf(destAddress);
      if (iU !== -1 && jU !== -1) {
        return {
          exchange: this.address,
          i: iU,
          j: jU,
          underlyingSwap: true,
        };
      }
    }

    throw new Error(
      `${this.fullName}: one or both tokens can not be exchanged in this pool: ${srcAddress} -> ${destAddress}`,
    );
  }
}
