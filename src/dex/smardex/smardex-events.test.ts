/* eslint-disable no-console */
import dotenv from 'dotenv';
import { Interface } from '@ethersproject/abi';
dotenv.config();

import SmardexPoolLayerOneABI from '../../abi/smardex/layer-1/smardex-pool.json';
// import SmardexPoolLayerTwoABI from '../../abi/smardex/layer-2/smardex-pool.json';
import { SmardexEventPool } from './smardex';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import {
  testEventSubscriber,
} from '../../../tests/utils-events';
import {
  SmardexPoolState,
} from './types';

jest.setTimeout(120 * 1000);
const dexKey = 'Smardex';
const network = Network.MAINNET;
// const config = SmardexConfig[dexKey][network];

async function fetchPoolStateFromContractAtBlock(
  smardexEventPool: SmardexEventPool,
  blockNumber: number,
  poolAddress: string,
  logger: any,
): Promise<SmardexPoolState | undefined> {
  const message = `Smardex: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);

  const state = await smardexEventPool.generateState(blockNumber);
  console.log(`Done ${message}`);

  return state;
}

describe('Smardex Ethereum SDEX-USDT Pool Event', function () {
  const poolAddress = '0xd2bf378cea07fe117ffdfd3f5b7e53c2b0b78c05'; // sdex-usdt
  const token0 = { address: '0x5de8ab7e27f6e7a1fff3e5b337584aa43961beef', decimals: 18 };
  const token1 = { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 };

  const blockNumbers: { [eventName: string]: number[] } = {
    ['Swap']: [
      18064045,
      // 18064060, 18064194, 18065266, //18066464, // the last one contains multiple Swap events
    ],
    // ['Burn']: [1806404500000],
    // ['Mint']: [1806404500000],
    ['SetFeeProtocol']: [],
    ['Sync']: [
      18064045,
      // 18064060, 18064194, 18065266, //18066464, // the last one contains multiple Snyc events
    ],
    ['Transfer']: [18064025],
  };

  describe('SmardexEventPool ethereum', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);

          const logger = dexHelper.getLogger(dexKey);

          const SmardexPool = new SmardexEventPool(
            new Interface(SmardexPoolLayerOneABI),
            dexHelper,
            poolAddress,
            token0,
            token1,
            logger,
            undefined,
            undefined,
          );

          // It is done in generateState. But here have to make it manually
          // SmardexPool.poolAddress = poolAddress.toLowerCase();
          // SmardexPool.addressesSubscribed[0] = poolAddress.toLowerCase();

          await testEventSubscriber(
            SmardexPool,
            SmardexPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolStateFromContractAtBlock(
                SmardexPool,
                _blockNumber,
                poolAddress,
                logger,
              ),
            blockNumber,
            `${dexKey}_${poolAddress}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
