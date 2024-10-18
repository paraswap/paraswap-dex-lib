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

async function delay(seconds: number): Promise<void> {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r${i} second${i !== 1 ? 's' : ''} left`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write("\rTime's up!    \n");
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
  const dexFactory: Address = '0xf9b539cd37fc81bbea1f078240d16b988bbae073';

  const poolFetchEventsToTest: Record<Address, EventMappings> = {
    [dexFactory]: {
      DexDeployed: [20982078],
    },
  };

  // poolAddress -> EventMappings
  const poolUpdateEventsToTest: Record<Address, EventMappings> = {
    [dexFactory]: {
      LogOperate: [20982078],
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
                  console.log('hello');

                  const ts: TenderlySimulation = new TenderlySimulation(
                    network,
                  );

                  await ts.setup();

                  const forkId = ts.forkId;
                  dexHelper.replaceProviderWithRPC(
                    `https://rpc.tenderly.co/fork/${forkId}`,
                  );

                  console.log(forkId);

                  const pools =
                    fluidDex.fluidCommonAddresses.getState(blockNumber);
                  let pool: string | undefined;

                  if (pools) {
                    for (let i = 0; i < pools.length; i++) {
                      if (
                        pools[i].token0.toLowerCase() ===
                          '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0' &&
                        pools[i].token1.toLowerCase() ===
                          '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                      ) {
                        pool = pools[i].address.toLowerCase();
                        break;
                      }
                    }
                  } else {
                    console.error('Pools data is null or undefined');
                  }

                  fluidDexEventPool = fluidDex.eventPools[`FluidDex_${pool}`];
                  console.log(
                    `this is the dex key that i fetched from writing the for loop FluidDex_${pool}`,
                  );

                  // console.log(fluidDexEventPool.dexHelper.provider);

                  console.log(
                    'eth balance before : ' +
                      (await dexHelper.provider.getBalance(
                        '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                      )),
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
                    data: '0xe3ead59e000000000000000000000000000010036c0190e009a000d0fc3541100a07380a0000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca0000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000005af3107a400000000000000000000000000000000000000000000000000000006a6b745e1dd000000000000000000000000000000000000000000000000000006b7ea416a9c0a47d24fdc9fd475bb1cc320a468c050100000000000000000000000001405b6c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000180000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001807f39c581f595b53c5cb19bd0b3f8da6c935e2ca00000006000000044ff00000000000000000000000000000000000000000000000000000000000000095ea7b300000000000000000000000025f0a3b25cbc0ca0417770f686209628323ff901ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff25f0a3b25cbc0ca0417770f686209628323ff901000000a00024000000000007000000000000000000000000000000000000000000000000000000002668dfaa000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000005af3107a400000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006a000f20005980200259b80c5102003040001068',
                  });

                  console.log('swap txn (isSuccess?) : ' + swapTxn.success);

                  console.log(
                    'eth balance after : ' +
                      (await dexHelper.provider.getBalance(
                        '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                      )),
                  );

                  const txnBlockNumber = swapTxn.transaction.block_number;

                  console.log(txnBlockNumber);
                  console.log(await dexHelper.provider.getBlockNumber());

                  await delay(30);

                  console.log(
                    'state 1 block before : ' +
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
