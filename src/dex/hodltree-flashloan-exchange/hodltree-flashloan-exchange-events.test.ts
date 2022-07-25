import dotenv from 'dotenv';
dotenv.config();

import { HodltreeFlashloanExchangeEventPool } from './hodltree-flashloan-exchange';
import { HodltreeFlashloanExchangeConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import axios from 'axios';
import { PoolStateMap } from './types';

/*
  README
  ======

  This test script adds unit tests for HodltreeFlashloanExchange event based 
  system. This is done by fetching the state on-chain before the 
  event block, manually pushing the block logs to the event-subsriber, 
  comparing the local state with on-chain state. 

  Most of the logic for testing is abstracted by `testEventSubscriber`.
  You need to do two things to make the tests work: 
  
  1. Fetch the block numbers where certain events were released. You
  can modify the `./scripts/fetch-event-blocknumber.ts` to get the 
  blocknumbers for different events. Make sure to get sufficient
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
const dexKey = 'HodltreeFlashloanExchange';
const network = Network.ROPSTEN;
const config = HodltreeFlashloanExchangeConfig[dexKey][network];

async function fetchPoolState(
  hodltreeFlashloanExchangePools: HodltreeFlashloanExchangeEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolStateMap> {
  return await hodltreeFlashloanExchangePools.generateState(blockNumber);
}

describe('HodltreeFlashloanExchange Event', function () {
  const blockNumbers: { [eventName: string]: [number, string][] } = {
    Borrow: [[12240009, '0x54fd1093bB4c64a5A80bb4E6c61E108C0eb994f2']],
    Supply: [[12240006, '0x54fd1093bB4c64a5A80bb4E6c61E108C0eb994f2']],
    Withdraw: [[12240015, '0x54fd1093bB4c64a5A80bb4E6c61E108C0eb994f2']],
  };

  describe('HodltreeFlashloanExchangeEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach(([blockNumber, poolAddress]) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const hodltreeFlashloanExchangePools =
            new HodltreeFlashloanExchangeEventPool(
              dexKey,
              network,
              dexHelper,
              logger,
              HodltreeFlashloanExchangeConfig.HodltreeFlashloanExchange[
                network
              ].exchange,
              HodltreeFlashloanExchangeConfig.HodltreeFlashloanExchange[
                network
              ].pools,
            );

          await testEventSubscriber(
            hodltreeFlashloanExchangePools,
            hodltreeFlashloanExchangePools.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(
                hodltreeFlashloanExchangePools,
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
