/*

The purpose of this script is to measure the real calculation time for price
request worst case scenario.

*/
import * as dotenv from 'dotenv';
import { getLogger } from '../../../lib/log4js';
import { DeepReadonly } from 'ts-essentials';
dotenv.config();
import { Network, SwapSide } from '../../../constants';
import { DummyDexHelper } from '../../../dex-helper';
import { uniswapV3Math } from '../contract-math/uniswap-v3-math';
import { PoolState } from '../types';
import { DfynV2 } from '../dfyn-v2';

const logger = getLogger('UniswapV3MeasureScript');

const runsNumber = 1000;
const printFrequency = 100;
const network = Network.MAINNET;
const dexHelper = new DummyDexHelper(network);

const uniV3 = new DfynV2(network, 'UniswapV3', dexHelper);

// USDC
const srcToken = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  decimals: 6,
};

// WETH
const destToken = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18,
};

// 2_000_000 -> 100_000_000 (50 chunks)
const amounts = [
  0n,
  2000000000000n,
  4000000000000n,
  6000000000000n,
  8000000000000n,
  10000000000000n,
  12000000000000n,
  14000000000000n,
  16000000000000n,
  18000000000000n,
  20000000000000n,
  22000000000000n,
  24000000000000n,
  26000000000000n,
  28000000000000n,
  30000000000000n,
  32000000000000n,
  34000000000000n,
  36000000000000n,
  38000000000000n,
  40000000000000n,
  42000000000000n,
  44000000000000n,
  46000000000000n,
  48000000000000n,
  50000000000000n,
  52000000000000n,
  54000000000000n,
  56000000000000n,
  58000000000000n,
  60000000000000n,
  62000000000000n,
  64000000000000n,
  66000000000000n,
  68000000000000n,
  70000000000000n,
  72000000000000n,
  74000000000000n,
  76000000000000n,
  78000000000000n,
  80000000000000n,
  82000000000000n,
  84000000000000n,
  86000000000000n,
  88000000000000n,
  90000000000000n,
  92000000000000n,
  94000000000000n,
  96000000000000n,
  98000000000000n,
  100000000000000n,
  1000000000000000n,
  10000000000000000n,
  100000000000000000n,
];
const side = SwapSide.SELL;

const sortTokens = (srcAddress: string, destAddress: string) => {
  return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
};

const [token0] = sortTokens(
  srcToken.address.toLowerCase(),
  destToken.address.toLowerCase(),
);

const zeroForOne = token0 === srcToken.address.toLowerCase() ? true : false;

const executeGetPricesVolume = async (blockNumber: number) => {
  await uniV3.getPricesVolume(srcToken, destToken, amounts, side, blockNumber);
};

const executeOnlySyncOperations = async (states: DeepReadonly<PoolState>[]) => {
  await Promise.all(
    states.map(async state => {
      await uniswapV3Math.queryOutputs(state, amounts, zeroForOne, side);
    }),
  );
};

const aggregateAndPrintMeasures = (measures: number[]) => {
  const sum = measures.reduce((a, b) => a + b);
  logger.info(
    `Measured ${measures.length}. Average = ${(sum / measures.length).toFixed(
      2,
    )} ms. Max = ${Math.max(...measures)} ms. Min = ${Math.min(
      ...measures,
    )} ms. `,
  );
};

const runOneSuite = async (func: Function) => {
  let counter = 0;
  const measures = [];

  while (counter < runsNumber) {
    const start = Date.now();

    await func();

    const elapsed = Date.now() - start;
    measures.push(elapsed);
    if (measures.length % printFrequency === 0) {
      aggregateAndPrintMeasures(measures);
    }
    counter++;
  }
  logger.info('\n');
  aggregateAndPrintMeasures(measures);
};

(async function main() {
  logger.info(`Started measurement script for ${runsNumber} runs...\n`);

  const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();

  // Fetch all states and calculation variables before measurement
  await executeGetPricesVolume(blockNumber);

  logger.info('\n');

  const states = Object.values(uniV3.eventPools).map(
    ep => ep!.getState(blockNumber)!,
  );

  logger.info(`\nRun for full calculation cycles\n`);
  await runOneSuite(executeGetPricesVolume.bind(undefined, blockNumber));

  logger.info(`\nRun for only sync cycles\n`);
  await runOneSuite(executeOnlySyncOperations.bind(undefined, states));

  logger.info(`Tests ended`);
})();
