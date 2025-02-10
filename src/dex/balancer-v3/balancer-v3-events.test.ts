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

  describe('Sepolia', function () {
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
        // https://sepolia.etherscan.io/tx/0x71f9879485f4e4cf97aa42381988ffe277f05a872d6b507cfa007cec1239a3f8#eventlog
        SwapFeePercentageChanged: {
          blockNumbers: [7206571],
          poolAddress: ['0xe69b70a86A4e1fD33dA95693A1aE12Be1c26C8ea'],
        },
        // https://sepolia.etherscan.io/tx/0xaf232ca2df59ba5fad38d74e9b54ec2ae1ad2e6abca8348f107cf3fd94c787c7#eventlog
        // Should remove pool from state as its paused and no longer supports swaps
        PoolPausedStateChanged: {
          blockNumbers: [7206586],
          poolAddress: ['0xe69b70a86A4e1fD33dA95693A1aE12Be1c26C8ea'],
        },
        // https://sepolia.etherscan.io/tx/0xa23dc10bd0fbed7ffffe867766d9b0d7670ca4a0bc352669f547bc7775644349#eventlog
        AggregateSwapFeePercentageChanged: {
          blockNumbers: [7206701],
          poolAddress: ['0xe69b70a86A4e1fD33dA95693A1aE12Be1c26C8ea'],
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

  describe.only('Mainnet', function () {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);
    const logger = dexHelper.getLogger(dexKey);
    let balancerV3Pool: BalancerV3EventPool;

    // vault -> EventMappings
    // TODO once we have a new test deployment add tests for: AggregateSwapFeePercentageChanged, SwapFeePercentageChanged, PoolPausedStateChanged
    const eventsToTest: Record<Address, EventMappings> = {
      [BalancerV3Config.BalancerV3[network].vaultAddress]: {
        // decoding is broken here
        LiquidityAdded: {
          blockNumbers: [21690379, 21725514, 21725720, 21774068],
          poolAddress: ['0x8523bcadcda4bd329435940dcc49a7c4c0a14d94'],
        },
        // event handling is broken here
        LiquidityRemoved: {
          blockNumbers: [21788910],
          poolAddress: ['0x8523bcadcda4bd329435940dcc49a7c4c0a14d94'],
        },
        // Swap: {
        //   blockNumbers: [
        //     21699757, 21713472, 21720847, 21725661, 21726065, 21726207,
        //     21726207, 21726244, 21726244, 21726569, 21726570, 21726679,
        //     21726680, 21727101, 21727102, 21727116, 21727117, 21727222,
        //     21727223, 21727227, 21727228, 21727321, 21727322, 21727326,
        //     21727328, 21727435, 21727436, 21728387, 21728388, 21728461,
        //     21728461, 21728660, 21728661, 21728794, 21728795, 21728852,
        //     21728857, 21728959, 21728959, 21729037, 21729037, 21729068,
        //     21729069, 21729102, 21729102, 21729834, 21729835, 21730094,
        //     21730095, 21730315, 21730317, 21730410, 21730410, 21730541,
        //     21730541, 21730609, 21730610, 21731221, 21731229, 21731554,
        //     21731562, 21731705, 21731706, 21731755, 21731756, 21731996,
        //     21731996, 21732022, 21732023, 21732768, 21732769, 21732854,
        //     21732855, 21732904, 21732905, 21732938, 21732956, 21733184,
        //     21733186, 21733374, 21733374, 21733581, 21733582, 21733912,
        //     21733913, 21734190, 21734190, 21734231, 21734232, 21734312,
        //     21734313, 21734763, 21734764, 21734774, 21734775, 21734803,
        //     21734804, 21734859, 21734862, 21734897, 21734898, 21734912,
        //     21734912, 21735019, 21735019, 21735153, 21735154, 21735202,
        //     21735203, 21735304, 21735304, 21735344, 21735344, 21735426,
        //     21735426, 21735453, 21735454, 21735528, 21735528, 21735580,
        //     21735580, 21735582, 21735582, 21735899, 21735899, 21735950,
        //     21735950, 21735965, 21735965, 21736237, 21736240, 21736557,
        //     21736557, 21736895, 21736896, 21737109, 21737110, 21737134,
        //     21737135, 21737217, 21737218, 21737282, 21737283, 21738467,
        //     21738468, 21739666, 21739751, 21739752, 21740525, 21740526,
        //     21740593, 21740594, 21741012, 21741013, 21741251, 21741324,
        //     21741552, 21741553, 21742051, 21742443, 21742443, 21744368,
        //     21745994, 21748215, 21748989, 21751261, 21753253, 21753401,
        //     21753658, 21754152, 21754769, 21755337, 21758678, 21761208,
        //     21761633, 21762674, 21763589, 21767995, 21768208, 21769592,
        //     21770502, 21770975, 21771133, 21771180, 21772024, 21772436,
        //     21773393, 21774189, 21774979, 21775167, 21775575, 21776030,
        //     21776161, 21776164, 21778536, 21780632, 21781736, 21782187,
        //     21784542, 21785593, 21788579, 21788638, 21791514, 21791514,
        //   ],
        //   poolAddress: ['0x8523bcadcda4bd329435940dcc49a7c4c0a14d94'],
        // },
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
});
