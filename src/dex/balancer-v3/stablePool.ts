import { StableMutableState } from './types';

export function isStableMutableState(
  poolState: any,
): poolState is StableMutableState {
  return (
    poolState &&
    typeof poolState === 'object' &&
    'amp' in poolState &&
    'ampIsUpdating' in poolState &&
    'ampStartValue' in poolState &&
    'ampEndValue' in poolState &&
    'ampStartTime' in poolState &&
    'ampStopTime' in poolState
  );
}

// https://github.com/balancer/balancer-v3-monorepo/blob/009f2793abda248b150ccd15c1db25930c96ca82/pkg/pool-stable/contracts/StablePool.sol#L274
export function getAmplificationParameter(
  startValue: bigint,
  endValue: bigint,
  startTime: bigint,
  endTime: bigint,
  timestamp: bigint,
): bigint {
  let value: bigint;
  if (timestamp < endTime) {
    if (endValue > startValue) {
      value =
        startValue +
        ((endValue - startValue) * (timestamp - startTime)) /
          (endTime - startTime);
    } else {
      value =
        startValue -
        ((startValue - endValue) * (timestamp - startTime)) /
          (endTime - startTime);
    }
  } else {
    value = endValue;
  }
  return value;
}
