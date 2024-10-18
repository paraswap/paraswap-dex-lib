/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { FluidDexEventPool } from './fluid-dex-pool';
import { FluidDexCommonAddresses } from './fluid-dex-generate-pool';
import { FluidDex } from './fluid-dex';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { CommonAddresses, FluidDexPoolState, Pool } from './types';
import { FluidDexConfig } from './config';
import { DeepReadonly } from 'ts-essentials';
import { TenderlySimulation } from '../../../tests/tenderly-simulation';

/*
  README
  ======

  This test script adds unit tests for FluidDex event based
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

async function fetchPoolState(
  fluidDexPool: FluidDexEventPool,
  blockNumber: number,
): Promise<FluidDexPoolState> {
  return await fluidDexPool.generateState(blockNumber);
}

async function fetchTotalPools(
  fluidCommonAddresses: FluidDexCommonAddresses,
  blockNumber: number,
): Promise<DeepReadonly<Pool[]>> {
  return await fluidCommonAddresses.generateState(blockNumber);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stringifyCircular(obj: any, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    },
    space,
  );
}

function replacer(key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('FluidDex EventPool Mainnet', function () {
  const dexKey = 'FluidDex';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  const fluidDexCommonAddressStruct: CommonAddresses =
    FluidDexConfig[dexKey][network].commonAddresses;
  const liquidityProxy: Address = '0x52aa899454998be5b000ad077a46bbe360f4e497';
  const dexFactory: Address = '0xF9b539Cd37Fc81bBEA1F078240d16b988BBae073';

  const poolFetchEventsToTest: Record<Address, EventMappings> = {
    [dexFactory]: {
      DexDeployed: [20825862],
    },
  };

  // poolAddress -> EventMappings
  const poolUpdateEventsToTest: Record<Address, EventMappings> = {
    [dexFactory]: {
      LogOperate: [20825862],
    },
  };

  let fluidDexEventPool: FluidDexEventPool;
  let fluidDexCommonAddress: FluidDexCommonAddresses;

  Object.entries(poolUpdateEventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  const fluidDex = new FluidDex(network, dexKey, dexHelper);

                  await fluidDex.initializePricing(blockNumber);

                  const ts: TenderlySimulation = new TenderlySimulation(
                    network,
                  );

                  await ts.setup();

                  const forkId = ts.forkId;
                  dexHelper.replaceProviderWithRPC(
                    `https://rpc.tenderly.co/fork/${forkId}`,
                  );

                  console.log(forkId);

                  fluidDexEventPool =
                    fluidDex.eventPools[
                      'FluidDex_0x6d83f60eeac0e50a1250760151e81db2a278e03a'
                    ];

                  console.log(fluidDexEventPool.dexHelper.provider);

                  console.log(
                    'eth balance before : ' +
                      (await dexHelper.provider.getBalance(
                        '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                      )),
                  );

                  const allowanceTxn = await ts.simulate({
                    from: '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                    to: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // undefined in case of contract deployment
                    value: '0',
                    data: '0x095ea7b30000000000000000000000006a000f20005980200259b80c51020030400010680000000000000000000000000000000000000000000000056bc75e2d63100000',
                  });

                  console.log(
                    'allowance txn (isSuccess?) : ' + allowanceTxn.success,
                  );

                  const swapTxn = await ts.simulate({
                    from: '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                    to: '0x6a000f20005980200259b80c5102003040001068', // undefined in case of contract deployment
                    value: '0',
                    data: '0xe3ead59e000000000000000000000000a600910b670804230e00a100000d28000ae005c00000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca0000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000103ab964e9ceb0100000000000000000000000000000000000000000000000001064b0ec65b454c0ae160924eed54e7abfa6d4ced59c2447000000000000000000000000013f7447000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000180000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001807f39c581f595b53c5cb19bd0b3f8da6c935e2ca00000006000000044ff00000000000000000000000000000000000000000000000000000000000000095ea7b30000000000000000000000006d83f60eeac0e50a1250760151e81db2a278e03affffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6d83f60eeac0e50a1250760151e81db2a278e03a000000a00024000000000007000000000000000000000000000000000000000000000000000000002668dfaa00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006a000f20005980200259b80c5102003040001068',
                  });

                  console.log('swap txn (isSuccess?) : ' + swapTxn.success);

                  console.log(
                    'eth balance after : ' +
                      (await dexHelper.provider.getBalance(
                        '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                      )),
                  );

                  const txnBlockNumber = swapTxn.transaction.block_number;

                  await delay(30000);
                  console.log(
                    'state 1 block after : ' +
                      JSON.stringify(
                        await fluidDexEventPool.generateState(
                          txnBlockNumber - 2,
                        ),
                        replacer,
                        2,
                      ),
                  );
                  console.log(
                    'state 1 block after : ' +
                      JSON.stringify(
                        await fluidDexEventPool.generateState(
                          await dexHelper.provider.getBlockNumber(),
                        ),
                        replacer,
                        2,
                      ),
                  );
                });
              });
            });
          },
        );
      });
    },
  );

  Object.entries(poolFetchEventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  fluidDexCommonAddress = new FluidDexCommonAddresses(
                    'FluidDex',
                    fluidDexCommonAddressStruct,
                    network,
                    dexHelper,
                    logger,
                  );

                  await testEventSubscriber(
                    fluidDexCommonAddress,
                    fluidDexCommonAddress.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchTotalPools(fluidDexCommonAddress, _blockNumber),
                    blockNumber,
                    `${dexKey}_${poolAddress}`,
                    dexHelper.provider,
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
