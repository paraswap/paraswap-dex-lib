/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { BalancerV3EventPool } from './balancer-v3-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolStateMap, StableMutableState } from './types';
import { BalancerV3Config } from './config';
import _ from 'lodash';

/*
  README
  ======

  This test script adds unit tests for BalancerV3 event based
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
  `npx jest src/dex/balancer-v3/balancer-v3-events.test.ts`

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  balancerV3Pools: BalancerV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolStateMap> {
  const pools = await balancerV3Pools.generateState(blockNumber);
  // Filter to pool of interest
  return Object.entries(_.cloneDeep(pools) as PoolStateMap)
    .filter(([address]) => {
      return address.toLowerCase() === poolAddress.toLowerCase();
    })
    .reduce((acc, [address, pool]) => {
      acc[address] = pool;
      return acc;
    }, {} as PoolStateMap);
}

function stateCompare(state: PoolStateMap, expectedState: PoolStateMap) {
  if (state['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e']) {
    if (
      (
        expectedState[
          '0xd63db0b88dca565633fb8d70a70b9b8093d34a7e'
        ] as StableMutableState
      ).ampIsUpdating
    ) {
      compareAmpUpdating(state, expectedState);
    } else compareAmpStopped(state, expectedState);
  } else expect(state).toEqual(expectedState);
}

function compareAmpUpdating(state: PoolStateMap, expectedState: PoolStateMap) {
  // tokenRates and balancesLiveScaled18 are gradually increasing between blocks due to tokenRate (and can't be tracked via event) so will be ignored
  const compare = {
    ...state,
    ['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e']: _.omit(
      state['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e'],
      ['balancesLiveScaled18', 'tokenRates'],
    ),
  };
  const expectedCompare = {
    ...expectedState,
    ['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e']: _.omit(
      expectedState['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e'],
      ['balancesLiveScaled18', 'tokenRates'],
    ),
  };
  expect(compare).toEqual(expectedCompare);
}

function compareAmpStopped(state: PoolStateMap, expectedState: PoolStateMap) {
  if (state['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e']) {
    // tokenRates and balancesLiveScaled18 are gradually increasing between blocks due to tokenRate (and can't be tracked via event) so will be ignored
    // In Contract ampStartTime & ampStopTime are updated to timestamp event is called.
    // There doesn't appear to be a way to easily get timestamp non-async so we default to 0n which should have no effect.
    const compare = {
      ...state,
      ['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e']: _.omit(
        state['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e'],
        ['balancesLiveScaled18', 'tokenRates'],
      ),
    };
    const expectedCompare = {
      ...expectedState,
      ['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e']: {
        ..._.omit(expectedState['0xd63db0b88dca565633fb8d70a70b9b8093d34a7e'], [
          'balancesLiveScaled18',
          'tokenRates',
        ]),
        ampStartTime: 0n,
        ampStopTime: 0n,
      },
    };
    expect(compare).toEqual(expectedCompare);
  } else expect(state).toEqual(expectedState);
}

// eventName -> blockNumbers
type EventMappings = Record<string, EventData>;
type EventData = { blockNumbers: number[]; poolAddress: string[] };

describe('BalancerV3 EventPool', function () {
  const dexKey = 'BalancerV3';
  const network = Network.SEPOLIA;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let balancerV3Pool: BalancerV3EventPool;

  // vault -> EventMappings
  // TODO once we have a new test deployment add tests for: AggregateSwapFeePercentageChanged, SwapFeePercentageChanged, PoolPausedStateChanged
  const eventsToTest: Record<Address, EventMappings> = {
    [BalancerV3Config.BalancerV3[network].vaultAddress]: {
      // https://eth-sepolia.blockscout.com/tx/0xc417d38ad6e21250c9ddded37680b40f0991cfd3f8ae2d8b5800507a58d48c44
      LiquidityAdded: {
        blockNumbers: [7170937],
        poolAddress: ['0x2ff3b96e0057a1f25f1d62ab800554ccdb268ab8'],
      },
      // https://sepolia.etherscan.io/tx/0xc1596e26d51104b9236a0debc3e1946b30b82f92b8331639ad6f6aea2ff2decc
      LiquidityRemoved: {
        blockNumbers: [7170957],
        poolAddress: ['0x2ff3b96e0057a1f25f1d62ab800554ccdb268ab8'],
      },
      // https://sepolia.etherscan.io/tx/0x78d18503c2dd4458c94ec916b10c088bb4e8b90059676d00dbcec83f763d8c0e
      Swap: {
        blockNumbers: [7175721],
        poolAddress: ['0x2ff3b96e0057a1f25f1d62ab800554ccdb268ab8'],
      },
      // 7170034, AmpUpdateStarted, https://eth-sepolia.blockscout.com/tx/0xfbe2e53d9cede1dc900100a1d6e809a89d909746ac7b8cc011e93227af8dda8b?tab=logs
      // 7170069, AmpUpdateStopped, https://eth-sepolia.blockscout.com/tx/0x2ee2e1d5980013fdf1cf9c3789e0321fb598c2412db8ee8057fcfaffd1c792ab?tab=logs
      VaultAuxiliary: {
        blockNumbers: [7170034, 7170069],
        poolAddress: [
          '0xD63dB0B88dca565633fB8d70a70b9b8093d34A7E',
          '0xD63dB0B88dca565633fB8d70a70b9b8093d34A7E',
        ],
      },
    },
  };

  beforeEach(async () => {
    balancerV3Pool = new BalancerV3EventPool(
      dexKey,
      network,
      dexHelper,
      logger,
    );
  });

  Object.entries(eventsToTest).forEach(
    ([vaultAddress, events]: [string, EventMappings]) => {
      describe(`Events for Vault: ${vaultAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, eventData]: [string, EventData]) => {
            describe(`${eventName}`, () => {
              eventData.blockNumbers.forEach((blockNumber: number, i) => {
                it(`Pool: ${eventData.poolAddress[i]} State after ${blockNumber}`, async function () {
                  await testEventSubscriber(
                    balancerV3Pool,
                    balancerV3Pool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        balancerV3Pool,
                        _blockNumber,
                        eventData.poolAddress[i],
                      ),
                    blockNumber,
                    `${dexKey}_${vaultAddress}`,
                    dexHelper.provider,
                    stateCompare,
                  );
                });
              });
            });
          },
        );
      });
    },
  );
});
