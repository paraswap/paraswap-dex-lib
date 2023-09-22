/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { SolidlyV3EventPool } from './solidly-v3-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import {SolidlyV3Config} from "./config";
import {AbiItem} from "web3-utils";
import {Interface} from "@ethersproject/abi";
import StateMulticallABI from '../../abi/solidly-v3/SolidlyV3StateMulticall.abi.json';
import { decodeStateMultiCallResultWithRelativeBitmaps } from './utils';
import ERC20ABI from '../../abi/erc20.json';

/*
  README
  ======

  This test script adds unit tests for SolidlyV3 event based
  system. This is done by fetching the state on-chain before the
  event block, manually pushing the block logs to the event-subscriber,
  comparing the local state with on-chain state.

  Most of the logic for testing is abstracted by `testEventSubscriber`.
  You need to do two things to make the tests work:

  1. Fetch the block numbers where certain events were released. You
  can modify the `./scripts/fetch-event-blocknumber.ts` to get the
  block numbers for different events. Make sure to get sufficient
  number of blockNumbers to cover all possible cases for the event
  mutations.

  2. Complete the implementation for fetchPoolState function. The
  function should fetch the on-chain state of the event subscriber
  using just the blocknumber.

  The template tests only include the test for a single event
  subscriber. There can be cases where multiple event subscribers
  exist for a single DEX. In such cases additional tests should be
  added.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-events.test.ts`

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);
const dexKey = 'SolidlyV3';
const network = Network.MAINNET;
const config = SolidlyV3Config[dexKey][network];

async function fetchPoolStateFromContract(
  solidlyV3Pool: SolidlyV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `SolidlyV3: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Be careful to not request state prior to contract deployment
  // Otherwise need to use manual state sourcing from multicall
  // We had that mechanism, but removed it with this commit
  // You can restore it, but better just to find block after state multicall
  // deployment
  const state = solidlyV3Pool.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('SolidlyV3 Event', function () {
  const poolAddress = '0x3198EAdB777b9b6C789bfc89491774644E95eD7e';
  const token0 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const token1 = '0xdac17f958d2ee523a2206206994597c13d831ec7';

  const blockNumbers: { [eventName: string]: number[] } = {
    // topic0 - 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
    ['Swap']: [
      18185415, 18185632, 18185654, 18186489, 18186623, 18186845, 18186959, 18187709, 18187816,
      18187818, 18187846, 18187849, 18187881
    ],
  }

  describe('SolidlyV3EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);
          // await dexHelper.init();

          const logger = dexHelper.getLogger(dexKey);

          const solidlyV3Pool = new SolidlyV3EventPool(
            dexHelper,
            dexKey,
            new dexHelper.web3Provider.eth.Contract(
              StateMulticallABI as AbiItem[],
              config.stateMulticall,
            ),
            decodeStateMultiCallResultWithRelativeBitmaps,
            new Interface(ERC20ABI),
            config.factory,
            10n,
            token0,
            token1,
            logger,
            undefined,
            config.initHash,
          );

          // It is done in generateState. But here have to make it manually
          solidlyV3Pool.poolAddress = poolAddress.toLowerCase();
          solidlyV3Pool.addressesSubscribed[0] = poolAddress;

          await testEventSubscriber(
            solidlyV3Pool,
            solidlyV3Pool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolStateFromContract(
                solidlyV3Pool,
                _blockNumber,
                poolAddress,
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
