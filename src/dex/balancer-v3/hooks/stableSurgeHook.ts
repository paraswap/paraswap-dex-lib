import _ from 'lodash';
import { Log } from '../../../types';
import { DeepReadonly } from 'ts-essentials';
import { HookStateMap } from './balancer-hook-event-subscriber';
import { Interface } from '@ethersproject/abi';
import { Contract } from 'ethers';
import { IDexHelper } from '../../../dex-helper';
import { callData, decodeThrowError } from '../getOnChainState';

export const StableSurge = {
  type: 'StableSurge' as const,
};

export type StableSurgeConfig = {
  type: typeof StableSurge.type;
  factory: string;
  address: string;
};

export type StableSurgePoolSetting = {
  surgeThresholdPercentage: bigint;
  maxSurgeFeePercentage: bigint;
};

export type StableSurgeHookState = Record<string, StableSurgePoolSetting>;

/**
 * Retrieve any initial hook state required.
 * @returns
 */
export async function getStableSurgeHookState(
  hookInterface: Interface,
  hookAddress: string,
  factoryAddress: string,
  dexHelper: IDexHelper,
  blockNumber: number,
): Promise<StableSurgeHookState> {
  // Find all pools with hook
  const resolverContract = new Contract(
    factoryAddress,
    ['function getPools() external view returns (address[])'],
    dexHelper.provider,
  );
  const pools = (await resolverContract.callStatic.getPools({
    blockTag: blockNumber,
  })) as string[];
  // query result for 1e18 (this maintains correct scaling for different token decimals in maths)
  const surgeThresholdCallData: callData[] = pools.flatMap(pool => {
    return [
      {
        target: hookAddress,
        callData: hookInterface.encodeFunctionData(
          'getSurgeThresholdPercentage',
          [pool],
        ),
      },
      {
        target: hookAddress,
        callData: hookInterface.encodeFunctionData('getMaxSurgeFeePercentage', [
          pool,
        ]),
      },
    ];
  });

  // 500 is an arbitrary number chosen based on the blockGasLimit
  const slicedMultiCallData = _.chunk(surgeThresholdCallData, 500);

  const multicallDataResult = (
    await Promise.all(
      slicedMultiCallData.map(async _multiCallData =>
        dexHelper.multiContract.methods
          .tryAggregate(false, _multiCallData)
          .call({}, blockNumber),
      ),
    )
  ).flat();

  return mapPoolsToDecodedData(hookInterface, pools, multicallDataResult);
}

function mapPoolsToDecodedData(
  hookInterface: Interface,
  pools: string[],
  data: any[],
): StableSurgeHookState {
  return pools.reduce((acc, pool, index) => {
    // Get the corresponding data indices for this pool
    const dataIndex = index * 2;

    // Ensure we have enough data
    if (dataIndex + 1 >= data.length) {
      throw new Error(`Insufficient data for pool ${pool}`);
    }

    // Decode the corresponding data pairs
    const decodedX = decodeThrowError(
      hookInterface,
      'getSurgeThresholdPercentage',
      data[dataIndex],
      'n/a',
    );
    const decodedY = decodeThrowError(
      hookInterface,
      'getMaxSurgeFeePercentage',
      data[dataIndex + 1],
      'n/a',
    );
    // Add to accumulator
    acc[pool.toLowerCase()] = {
      surgeThresholdPercentage: decodedX[0].toBigInt(),
      maxSurgeFeePercentage: decodedY[0].toBigInt(),
    };

    return acc;
  }, {} as StableSurgeHookState);
}

/**
 * Handles the event emitted when threshold surge percentage changed.
 * @param event
 * @param state
 * @param log
 * @returns
 */
export function thresholdSurgePercentageChangedEvent(
  event: any,
  state: DeepReadonly<HookStateMap>,
  log: Readonly<Log>,
): DeepReadonly<HookStateMap> | null {
  // ThresholdSurgePercentageChanged(pool, newSurgeThresholdPercentage)
  const hookAddress = log.address.toLowerCase();
  if (!state[hookAddress]) {
    return null;
  }
  const newState = _.cloneDeep(state) as HookStateMap;
  (newState[hookAddress] as StableSurgeHookState)[
    event.args.pool
  ].surgeThresholdPercentage = BigInt(event.args.newSurgeThresholdPercentage);
  return newState;
}

/**
 * Handles the event emitted when max surge fee percentage changed.
 * @param event
 * @param state
 * @param log
 * @returns
 */
export function maxSurgeFeePercentageChangedEvent(
  event: any,
  state: DeepReadonly<HookStateMap>,
  log: Readonly<Log>,
): DeepReadonly<HookStateMap> | null {
  // MaxSurgeFeePercentageChanged(pool, newMaxSurgeFeePercentage)
  const hookAddress = log.address.toLowerCase();
  if (!state[hookAddress]) {
    return null;
  }
  const newState = _.cloneDeep(state) as HookStateMap;
  (newState[hookAddress] as StableSurgeHookState)[
    event.args.pool
  ].maxSurgeFeePercentage = BigInt(event.args.newMaxSurgeFeePercentage);
  return newState;
}
