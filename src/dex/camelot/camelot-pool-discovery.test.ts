import dotenv from 'dotenv';
dotenv.config();

import { Network, SwapSide } from '../../constants';
import { DummyDexHelper } from '../../dex-helper';
import { BlockHeader } from 'web3-eth';
import { Camelot } from './camelot';
import { CamelotConfig } from './config';
import { Log } from 'web3-core';

const network = Network.ARBITRUM;
const dexKey = 'Camelot';

interface Pool {
  startBlockNumber: number;
  endBlockNumber: number;
  address: string;
  srcToken: { address: string; decimals: number };
  destToken: { address: string; decimals: number };
}

const factoryAddress = CamelotConfig[dexKey][network].factoryAddress;
const blockHeaders: Record<number, BlockHeader> = {};

const pools: Pool[] = [
  {
    address: '0x19d51dc52e52407656b40b197b1bbe14294b955b',
    startBlockNumber: 162099096,
    endBlockNumber: 162099098,
    srcToken: {
      address: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`,
      decimals: 18,
    },
    destToken: {
      address: '0x939727d85D99d0aC339bF1B76DfE30Ca27C19067',
      decimals: 18,
    },
  },
  {
    address: '0x8b5c25d5f9be67dc6243e2fafcb36ec10ba54aa2',
    startBlockNumber: 163124111,
    endBlockNumber: 163124113,
    srcToken: {
      address: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`,
      decimals: 18,
    },
    destToken: {
      address: '0x38CC4c71425e9aB6B0A6Ec4240121598efE08398',
      decimals: 18,
    },
  },
];

function groupAndSortLogsByBlockNumber(logsToDispatch: any[]): {
  logsByBlockNumber: Record<number, any[]>;
  sortedBlocks: number[];
} {
  const logsByBlockNumber: Record<number, any[]> = {};
  for (let log of logsToDispatch) {
    if (!logsByBlockNumber[log.blockNumber]) {
      logsByBlockNumber[log.blockNumber] = [];
    }
    logsByBlockNumber[log.blockNumber].push(log);
  }

  const sortedBlocks = Object.keys(logsByBlockNumber)
    .map(Number)
    .sort((a, b) => Number(a) - Number(b));

  return { logsByBlockNumber, sortedBlocks };
}

async function testPoolDiscovery(pool: Pool) {
  const { startBlockNumber, endBlockNumber, srcToken, destToken, address } =
    pool;
  describe(`${address}: from ${startBlockNumber} to ${endBlockNumber}`, () => {
    const dexHelper = new DummyDexHelper(network);
    const camelot = new Camelot(network, dexKey, dexHelper);

    let logsByBlockNumber: Record<number, Log[]> = {};
    let sortedBlocks: number[] = [];

    it('should have pair created event', async () => {
      const logsToDispatch = await dexHelper.provider.getLogs({
        fromBlock: startBlockNumber,
        toBlock: endBlockNumber,
        address: factoryAddress,
      });

      expect(logsToDispatch.length).toBe(1);

      const groupedLogs = groupAndSortLogsByBlockNumber(logsToDispatch);
      logsByBlockNumber = groupedLogs.logsByBlockNumber;
      sortedBlocks = groupedLogs.sortedBlocks;
    });

    it('prices before pool discovery should be empty', async () => {
      // override default block to force camelot.factory.call() use block before pool was created
      camelot.factory.defaultBlock = startBlockNumber;
      const pricesBeforePoolDiscovery = await camelot.getPricesVolume(
        srcToken,
        destToken,
        [10000000000000000000n, 10000000000000000000n],
        SwapSide.SELL,
        startBlockNumber,
      );

      // prices before pool created should not be available
      expect(pricesBeforePoolDiscovery).toBe(null);
    });

    it('prices after pool discovery should not be empty', async () => {
      // @ts-ignore
      // initialize factory state
      await camelot.factoryInst?.initialize(startBlockNumber);

      for (let blockNumber of sortedBlocks) {
        if (!blockHeaders[blockNumber]) {
          blockHeaders[blockNumber] = await dexHelper.web3Provider.eth.getBlock(
            blockNumber,
          );
        }

        // override default block to force camelot.factory.call() use specific block
        camelot.factory.defaultBlock = blockNumber;

        // @ts-ignore
        // emit PairCreated event for factory
        await camelot.factoryInst?.update(logsByBlockNumber[blockNumber], {
          [blockNumber]: blockHeaders[blockNumber],
        });
      }

      const pricesAfterPoolDiscovery = await camelot.getPricesVolume(
        srcToken,
        destToken,
        [10000000000000000000n, 10000000000000000000n],
        SwapSide.SELL,
        endBlockNumber,
      );

      expect(pricesAfterPoolDiscovery).not.toBe(null);
    });
  });
}

describe(`Test ${dexKey} pool discovery`, () => {
  pools.forEach(pool => testPoolDiscovery(pool));
});
