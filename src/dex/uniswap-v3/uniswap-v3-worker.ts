import { parentPort, workerData } from 'worker_threads';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';
import { DeepReadonly } from 'ts-essentials';
import { PoolState } from './types';
import { SwapSide } from '@paraswap/core';
import { _getOutputs } from './uniswap-v3-pricing';

type Input = {
  state: DeepReadonly<PoolState>;
  amounts: bigint[];
  zeroForOne: boolean;
  side: SwapSide;
  destTokenBalance: bigint;
  fmode?: boolean;
};

const { state, amounts, zeroForOne, side, destTokenBalance, fmode }: Input =
  workerData;
const result = _getOutputs(
  state,
  amounts,
  zeroForOne,
  side,
  destTokenBalance,
  fmode,
);

if (parentPort) {
  parentPort.postMessage(result);
}
