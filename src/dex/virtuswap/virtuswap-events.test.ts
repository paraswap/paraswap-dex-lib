/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { VirtuSwapEventPool } from './virtuswap-pool';
import { VirtuSwapFactory } from './virtuswap-factory';
import { Network } from '../../constants';
import { Address } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { DeepReadonly } from 'ts-essentials';
import { VirtuSwapConfig } from './config';

jest.setTimeout(50 * 1000);

async function fetchEventSubscriberState<State>(
  eventSubscriber: StatefulEventSubscriber<State>,
  blockNumber: number,
): Promise<DeepReadonly<State>> {
  return eventSubscriber.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

const dexKey = 'VirtuSwap';

describe('VirtuSwap EventPool', function () {
  // networkId -> poolAddress -> EventMappings
  const eventsToTest: Partial<Record<Network, Record<Address, EventMappings>>> =
    {
      [Network.POLYGON]: {
        // VRSW-WETH
        '0x68BfaE97d4970ba6f542c2a93Ed2e6eDBBf96c3b': {
          ReserveSync: [55283344, 55373346],
          vSync: [55395552, 55402173, 55430710, 55433860],
        },
        // WMATIC-USDC.e
        '0x61e7Af17bA4F3C41D0d30D15133C02E1Eb6a160b': {
          ReserveSync: [55323873],
          vSync: [55419625, 55432335],
        },
        // WMATIC-DECATS
        '0x3EF0458a06b7507112fC67cD2aaa636e93C29d91': {
          ReserveSync: [50556813], // Liquidate Reserve
          AllowListChanged: [52799588, 52799593, 52799696], // Set Allow List
        },
        // USDC.e-USDT
        '0x718C2A6A8F60026E13f406aF077B0D84D075d222': {
          AllowListChanged: [52799297, 52799705],
          ReserveSync: [55467619, 55468496],
        },
      },
      [Network.ARBITRUM]: {
        // VRSW-USDC.e
        '0xD7d90067A07620EdEc49665B5703E539811aeb17': {
          ReserveSync: [196701768, 196876948],
          vSync: [197478498],
        },
      },
    };

  Object.entries(eventsToTest).forEach(([networkId, eventsInfos]) => {
    describe(`Network id: ${networkId}`, () => {
      const network = parseInt(networkId) as Network;
      const params = VirtuSwapConfig[dexKey][network];
      const dexHelper = new DummyDexHelper(network);
      const logger = dexHelper.getLogger(dexKey);
      Object.entries(eventsInfos).forEach(([poolAddress, eventsMap]) => {
        describe(`Events for ${poolAddress}`, () => {
          const virtuswapPool = new VirtuSwapEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            params.isTimestampBased,
            poolAddress,
          );
          Object.entries(eventsMap).forEach(
            ([eventName, blockNumbers]: [string, number[]]) => {
              describe(`${eventName}`, () => {
                blockNumbers.forEach((blockNumber: number) => {
                  it(`State after ${blockNumber}`, async function () {
                    await testEventSubscriber(
                      virtuswapPool,
                      virtuswapPool.addressesSubscribed,
                      (_blockNumber: number) =>
                        fetchEventSubscriberState(virtuswapPool, _blockNumber),
                      blockNumber,
                      `${dexKey}_${networkId}_${poolAddress}`,
                      dexHelper.provider,
                    );
                  });
                });
              });
            },
          );
        });
      });
    });
  });
});

describe('VirtuSwap Pair Factory', function () {
  // networkId -> EventMappings
  const eventsToTest: Partial<Record<Network, EventMappings>> = {
    [Network.POLYGON]: {
      PairCreated: [51241515, 52520527, 54425830],
    },
    [Network.ARBITRUM]: {
      PairCreated: [185284849, 185289818, 185290439],
    },
  };

  Object.entries(eventsToTest).forEach(([networkId, eventsMap]) => {
    const network = parseInt(networkId) as Network;
    const params = VirtuSwapConfig[dexKey][network];
    describe(`Network id: ${networkId}, factory: ${params.factoryAddress}`, () => {
      const dexHelper = new DummyDexHelper(network);
      const logger = dexHelper.getLogger(dexKey);
      const virtuswapFactory = new VirtuSwapFactory(
        dexKey,
        network,
        dexHelper,
        logger,
        () => {},
        params.factoryAddress,
      );
      Object.entries(eventsMap).forEach(
        ([eventName, blockNumbers]: [string, number[]]) => {
          describe(`${eventName}`, () => {
            blockNumbers.forEach((blockNumber: number) => {
              it(`State after ${blockNumber}`, async function () {
                await testEventSubscriber(
                  virtuswapFactory,
                  virtuswapFactory.addressesSubscribed,
                  (_blockNumber: number) =>
                    fetchEventSubscriberState(virtuswapFactory, _blockNumber),
                  blockNumber,
                  `${dexKey}_${networkId}_factory_${params.factoryAddress}`,
                  dexHelper.provider,
                );
              });
            });
          });
        },
      );
    });
  });
});
