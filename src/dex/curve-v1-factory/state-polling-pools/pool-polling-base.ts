import Web3EthAbi, { AbiCoder } from 'web3-eth-abi';
import { Logger } from 'log4js';
import { MultiCallParams } from '../../../lib/multi-wrapper';
import {
  MAX_ALLOWED_STATE_DELAY_FACTOR,
  MIN_LIQUIDITY_IN_USD,
} from '../constants';
import { CurveV1FactoryData, PoolConstants, PoolState } from '../types';
import { Address } from '@paraswap/core';

export type MulticallReturnedTypes = bigint | bigint[];

export abstract class PoolPollingBase {
  // Used for logger. Better to have which class is failing
  readonly CLASS_NAME = this.constructor.name;

  readonly fullName: string;

  protected _poolState: PoolState | null = null;

  protected abiCoder = Web3EthAbi as unknown as AbiCoder;

  // This values is used in PoolTracker
  liquidityUSD = 0;

  readonly isMetaPool: boolean;
  // For more efficient search in coins
  readonly coinsToIndices: Record<Address, number>;
  readonly underlyingCoinsToIndices: Record<Address, number>;
  readonly underlyingDecimals: number[];

  // Custom pools usually are not used for pricing. But there examples, when
  // factory plain goes as custom one. In that case we must use that for pricing
  readonly isUsedForPricing: boolean = true;

  constructor(
    readonly logger: Logger,
    readonly dexKey: string,
    readonly network: number,
    readonly cacheStateKey: string,
    readonly implementationName: string,
    readonly implementationAddress: Address,
    readonly stateUpdatePeriodMs: number,
    readonly poolIdentifier: string,
    readonly poolConstants: PoolConstants,
    readonly address: Address,
    readonly curveLiquidityApiSlug: string,
    readonly isLendingPool: boolean,
    readonly baseStatePoolPolling: PoolPollingBase | undefined,
    readonly isSrcFeeOnTransferSupported: boolean,
  ) {
    this.fullName = `${dexKey}-${network}-${this.CLASS_NAME}-${this.implementationName}-${this.address}`;
    this.isMetaPool = baseStatePoolPolling !== undefined;
    this.coinsToIndices = this._reduceToIndexMapping(poolConstants.COINS);
    this.underlyingCoinsToIndices = baseStatePoolPolling
      ? this._reduceToIndexMapping([
          poolConstants.COINS[0],
          ...baseStatePoolPolling.poolConstants.COINS,
        ])
      : {};
    this.underlyingDecimals = baseStatePoolPolling
      ? [
          poolConstants.coins_decimals[0],
          ...baseStatePoolPolling.poolConstants.coins_decimals,
        ]
      : [];
  }

  async setState(newState: PoolState): Promise<void> {
    // If we need more fancy handling for state replacement, it is a good place for that
    this._poolState = newState;
  }

  // Each type of implementation: currently two (Factory and Custom) may have different
  // set of multicall requests. It is useful to make calls that shouldn't fail
  abstract getStateMultiCalldata(): MultiCallParams<MulticallReturnedTypes>[];

  abstract parseMultiResultsToStateValues(
    multiOutputs: MulticallReturnedTypes[],
    blockNumber: number | 'latest',
    updatedAtMs: number,
  ): PoolState;

  isStateUpToDate(state: PoolState | null): boolean {
    return (
      state !== null &&
      Date.now() - state.updatedAtMs <
        this.stateUpdatePeriodMs * MAX_ALLOWED_STATE_DELAY_FACTOR
    );
  }

  getState(): PoolState | null {
    if (this.isStateUpToDate(this._poolState)) {
      return this._poolState;
    } else if (this._poolState) {
      this.logger.error(
        `${this.fullName} getState: state is older than max allowed time`,
      );
    } else {
      this.logger.error(
        `${this.fullName} getState: state was not initialized properly`,
      );
    }

    return null;
  }

  hasEnoughLiquidity(): boolean {
    return this.liquidityUSD > MIN_LIQUIDITY_IN_USD;
  }

  getPoolData(
    srcAddress: Address,
    destAddress: Address,
  ): CurveV1FactoryData | null {
    const iC = this.coinsToIndices[srcAddress];
    const jC = this.coinsToIndices[destAddress];

    if (iC !== undefined && jC !== undefined) {
      return {
        exchange: this.address,
        i: iC,
        j: jC,
        underlyingSwap: false,
      };
    }

    if (this.isMetaPool) {
      const iU = this.underlyingCoinsToIndices[srcAddress];
      const jU = this.underlyingCoinsToIndices[destAddress];

      // For metapool we want to consider exchange only if either of coins
      // src or dest are using 0 index (mixed exchange between meta and base pool)
      // If both of them > 0, then it is just ordinary pool and we shouldn't consider
      // this pool for exchange. Otherwise, we will have many duplicates for common pools
      // like ThreePool, where almost every pool will have USDT/DAI/USDC as there basis pool
      // While in current implementation we have customPools excluded from pricing,
      // I expect them to be included in old CurveV1 implementation
      if (iU !== undefined && jU !== undefined && !(iU > 0 && jU > 0)) {
        return {
          exchange: this.address,
          i: iU,
          j: jU,
          underlyingSwap: true,
        };
      }
    }

    return null;
  }

  private _reduceToIndexMapping(values: string[]): Record<string, number> {
    return values.reduce<Record<string, number>>((acc, curr, i) => {
      acc[curr] = i;
      return acc;
    }, {});
  }
}
