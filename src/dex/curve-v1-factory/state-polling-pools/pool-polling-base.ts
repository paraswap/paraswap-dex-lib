import Web3EthAbi, { AbiCoder } from 'web3-eth-abi';
import { Logger } from 'log4js';
import {
  MIN_LIQUIDITY_IN_USD,
  IS_LIQUIDITY_TRACKED,
  LIQUIDITY_ALLOWED_DELAY_PERIOD_MS,
} from '../constants';
import { CurveV1FactoryData, PoolConstants, PoolState } from '../types';
import { Address } from '@paraswap/core';
import { StatefulRpcPoller } from '../../../lib/stateful-rpc-poller/stateful-rpc-poller';
import { IDexHelper } from '../../../dex-helper';
import { pollingManagerCbExtractor } from '../../../lib/stateful-rpc-poller/utils';
import { StatePollingManager } from '../../../lib/stateful-rpc-poller/state-polling-manager';

export type MulticallReturnedTypes = bigint | bigint[];

export abstract class PoolPollingBase extends StatefulRpcPoller<
  PoolState,
  MulticallReturnedTypes
> {
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
    dexHelper: IDexHelper,
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
    readonly customGasCost: number | undefined,
    liquidityThresholdForUpdate: number = MIN_LIQUIDITY_IN_USD,
    liquidityUpdateAllowedDelayMs: number = LIQUIDITY_ALLOWED_DELAY_PERIOD_MS,
    isLiquidityTracked: boolean = IS_LIQUIDITY_TRACKED,
  ) {
    const callbacks = pollingManagerCbExtractor(
      StatePollingManager.getInstance(dexHelper),
    );

    super(
      dexKey,
      poolIdentifier,
      dexHelper,
      liquidityThresholdForUpdate,
      liquidityUpdateAllowedDelayMs,
      isLiquidityTracked,
      callbacks,
    );

    this.fullName = `${dexKey}-${this.network}-${this.CLASS_NAME}-${this.implementationName}-${this.address}`;
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
