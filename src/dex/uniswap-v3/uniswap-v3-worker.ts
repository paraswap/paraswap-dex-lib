import { parentPort, workerData } from 'worker_threads';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';
import { DeepReadonly } from 'ts-essentials';
import { PoolState } from './types';
import { SwapSide } from '@paraswap/core';

type Input = {
  state: DeepReadonly<PoolState>;
  amounts: bigint[];
  zeroForOne: boolean;
  side: SwapSide;
  destTokenBalance: bigint;
  fmode?: boolean;
};

function _getOutputs() {
  const { state, amounts, zeroForOne, side, destTokenBalance, fmode }: Input =
    workerData;
  try {
    const outputsResult = uniswapV3Math.queryOutputs(
      state,
      amounts,
      zeroForOne,
      side,
      fmode,
    );

    if (side === SwapSide.SELL) {
      if (outputsResult.outputs[0] > destTokenBalance) {
        return null;
      }

      for (let i = 0; i < outputsResult.outputs.length; i++) {
        if (outputsResult.outputs[i] > destTokenBalance) {
          outputsResult.outputs[i] = 0n;
          outputsResult.tickCounts[i] = 0;
        }
      }
    } else {
      if (amounts[0] > destTokenBalance) {
        return null;
      }

      // This may be improved by first checking outputs and requesting outputs
      // only for amounts that makes more sense, but I don't think this is really
      // important now
      for (let i = 0; i < amounts.length; i++) {
        if (amounts[i] > destTokenBalance) {
          outputsResult.outputs[i] = 0n;
          outputsResult.tickCounts[i] = 0;
        }
      }
    }

    return outputsResult;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug(`received error in _getOutputs while calculating outputs`, e);
    return null;
  }
}

const result = _getOutputs();

if (parentPort) {
  parentPort.postMessage(result);
}
