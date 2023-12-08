import { Interface } from '@ethersproject/abi';
import { Address } from '@paraswap/core';
import _ from 'lodash';

import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import { IDexHelper } from '../../dex-helper';
import { StatefulRpcPoller } from '../../lib/stateful-rpc-poller/stateful-rpc-poller';
import { StatePollingManager } from '../../lib/stateful-rpc-poller/state-polling-manager';
import { ObjWithUpdateInfo } from '../../lib/stateful-rpc-poller/types';
import { pollingManagerCbExtractor } from '../../lib/stateful-rpc-poller/utils';
import {
  addressArrayDecode,
  booleanDecode,
  uint256ToBigInt,
  uint8ToNumber,
} from '../../lib/decoders';
import PoolABI from '../../abi/wombat/pool.json';
import AssetABI from '../../abi/wombat/asset.json';
import { uint120ToBigInt } from './utils';
import { AssetState, MulticallResultOutputs, PoolState } from './types';

export class WombatPool extends StatefulRpcPoller<
  PoolState,
  MulticallResultOutputs
> {
  static readonly poolInterface = new Interface(PoolABI);
  static readonly assetInterface = new Interface(AssetABI);

  constructor(
    dexKey: string,
    poolIdentifier: string,
    dexHelper: IDexHelper,
    protected poolAddress: Address,
    protected asset2TokenMap: Map<Address, Address>,
  ) {
    const callbacks = pollingManagerCbExtractor(
      StatePollingManager.getInstance(dexHelper),
    );

    super(dexKey, poolIdentifier, dexHelper, 0, 0, false, callbacks);
  }

  protected _getFetchStateMultiCalls(): MultiCallParams<MulticallResultOutputs>[] {
    const params: MultiCallParams<MulticallResultOutputs>[] = [];

    params.push({
      target: this.poolAddress,
      callData: WombatPool.poolInterface.encodeFunctionData('paused'),
      decodeFunction: booleanDecode,
    });
    params.push({
      target: this.poolAddress,
      callData: WombatPool.poolInterface.encodeFunctionData('ampFactor'),
      decodeFunction: uint256ToBigInt,
    });
    params.push({
      target: this.poolAddress,
      callData: WombatPool.poolInterface.encodeFunctionData('haircutRate'),
      decodeFunction: uint256ToBigInt,
    });
    params.push({
      target: this.poolAddress,
      callData: WombatPool.poolInterface.encodeFunctionData('startCovRatio'),
      decodeFunction: uint256ToBigInt,
    });
    params.push({
      target: this.poolAddress,
      callData: WombatPool.poolInterface.encodeFunctionData('endCovRatio'),
      decodeFunction: uint256ToBigInt,
    });
    params.push({
      target: this.poolAddress,
      callData: WombatPool.poolInterface.encodeFunctionData('getTokens'),
      decodeFunction: addressArrayDecode,
    });

    this.asset2TokenMap.forEach((token, asset) => {
      params.push({
        target: this.poolAddress,
        callData: WombatPool.poolInterface.encodeFunctionData('isPaused', [
          token,
        ]),
        decodeFunction: booleanDecode,
      });
      params.push({
        target: asset,
        callData: WombatPool.assetInterface.encodeFunctionData('cash'),
        decodeFunction: uint120ToBigInt,
      });
      params.push({
        target: asset,
        callData: WombatPool.assetInterface.encodeFunctionData('liability'),
        decodeFunction: uint120ToBigInt,
      });
      params.push({
        target: asset,
        callData: WombatPool.assetInterface.encodeFunctionData(
          'underlyingTokenDecimals',
        ),
        decodeFunction: uint8ToNumber,
      });
      params.push({
        target: asset,
        callData:
          WombatPool.assetInterface.encodeFunctionData('getRelativePrice'),
        decodeFunction: uint256ToBigInt,
      });
    });

    return params;
  }

  protected _parseStateFromMultiResults(
    multiOutputs: MulticallResultOutputs[],
  ): PoolState {
    const [
      paused,
      ampFactor,
      haircutRate,
      startCovRatio,
      endCovRatio,
      tokens,
      ...remained
    ] = multiOutputs as [
      boolean,
      bigint,
      bigint,
      bigint,
      bigint,
      Address[],
      ...MulticallResultOutputs[],
    ];

    const assetTokenArray = Array.from(this.asset2TokenMap.entries());
    const token2AssetStates = new Map<Address, AssetState>();
    _.chunk(remained, 5).forEach((chunk, i) => {
      const [paused, cash, liability, underlyingTokenDecimals, relativePrice] =
        chunk as [boolean, bigint, bigint, number, bigint | undefined];

      const [asset, token] = assetTokenArray[i];
      token2AssetStates.set(token, {
        address: asset,
        paused,
        cash,
        liability,
        underlyingTokenDecimals,
        relativePrice,
      });
    });

    const poolState: PoolState = {
      params: {
        paused,
        ampFactor,
        haircutRate,
        startCovRatio,
        endCovRatio,
      },
      underlyingAddresses: tokens,
      asset: {},
    };

    const isMainPool =
      Array.from(token2AssetStates.values()).filter(
        assetState => assetState.relativePrice === undefined,
      ).length > 0;
    for (const token of poolState.underlyingAddresses) {
      if (!token2AssetStates.has(token)) {
        // this happens when asset has been added to pool but is not added to BMW yet
        continue;
      }
      poolState.asset[token] = token2AssetStates.get(token)!;
      if (isMainPool) {
        poolState.asset[token].relativePrice = undefined;
      }
    }

    return poolState;
  }

  public async fetchLatestStateFromRpc(): Promise<ObjWithUpdateInfo<PoolState> | null> {
    const multiCalls = this.getFetchStateWithBlockInfoMultiCalls();
    try {
      const lastUpdatedAtMs = Date.now();
      const aggregatedResults = (await this.dexHelper.multiWrapper.tryAggregate<
        number | MulticallResultOutputs
      >(
        false,
        multiCalls as MultiCallParams<MulticallResultOutputs | number>[],
        undefined,
        undefined,
        // multiCalls includes calls asset.isPaused, asset.getRelativePrice
        // some of the contracts don't have these methods, so prevent logging errors
        false,
      )) as [MultiResult<number>, ...MultiResult<MulticallResultOutputs>[]];

      return this.parseStateFromMultiResultsWithBlockInfo(
        aggregatedResults,
        lastUpdatedAtMs,
      );
    } catch (e) {
      this._logMessageWithSuppression('ERROR_FETCHING_STATE_FROM_RPC', e);
    }

    return null;
  }

  public parseStateFromMultiResultsWithBlockInfo(
    multiOutputs: [
      MultiResult<number>,
      ...MultiResult<MulticallResultOutputs>[],
    ],
    lastUpdatedAtMs: number,
  ): ObjWithUpdateInfo<PoolState> {
    const [blockNumber, ...outputsForAbstract] = multiOutputs.map((m, i) => {
      return m.returnData;
    }) as [number, ...MulticallResultOutputs[]];

    return {
      value: this._parseStateFromMultiResults(outputsForAbstract),
      blockNumber,
      lastUpdatedAtMs,
    };
  }

  public addAssets(asset2TokenMap: Map<Address, Address>) {
    for (const [asset, token] of asset2TokenMap) {
      if (this.asset2TokenMap.has(asset)) {
        continue;
      }

      this.asset2TokenMap.set(asset, token);
      this._cachedMultiCallData = undefined;
    }
  }
}
