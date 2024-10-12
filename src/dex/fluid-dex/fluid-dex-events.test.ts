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
import {
  commonAddresses,
  FluidDexPool,
  FluidDexPoolState,
  Pool,
} from './types';
import { FluidDexConfig } from './config';
import { DeepReadonly } from 'ts-essentials';
import {
  EstimateGasSimulation,
  TenderlySimulation,
  TransactionSimulator,
} from '../../../tests/tenderly-simulation';

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
  const fluidDexCommonAddressStruct: commonAddresses =
    FluidDexConfig[dexKey][network].commonAddresses;
  const liquidityProxy: Address = '0x52aa899454998be5b000ad077a46bbe360f4e497';
  const dexFactory: Address = '0x93dd426446b5370f094a1e31f19991aaa6ac0be0';

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
                  // const forkProvider = new ethers.JsonRpcProvider('https://mainnet.gateway.tenderly.co/5aa2627c-c6b9-4aa7-beec-a7352f78726b')

                  const fluidDex = new FluidDex(network, dexKey, dexHelper);

                  // const latestBlockNumber_ = await dexHelper.web3Provider.eth.getBlockNumber();

                  await fluidDex.initializePricing(blockNumber);

                  // console.log(stringifyCircular(Object.keys(fluidDex.eventPools).length))

                  const ts: TenderlySimulation = new TenderlySimulation(
                    network,
                    '5aa2627c-c6b9-4aa7-beec-a7352f78726b',
                  );

                  await ts.setup();

                  const forkId = ts.forkId;
                  console.log('this is ts fork id : ' + forkId);
                  dexHelper.replaceProviderWithRPC(
                    `https://rpc.tenderly.co/fork/${forkId}`,
                  );
                  // console.log("this is fork id : ", dexHelper.web3Provider, null, 2);
                  console.log(
                    'this is fork id : ',
                    JSON.stringify(dexHelper.provider, null, 2),
                  );

                  fluidDexEventPool =
                    fluidDex.eventPools[
                      'FluidDex_0x6d83f60eeac0e50a1250760151e81db2a278e03a'
                    ];

                  // console.log("eth balance before sned : " + await dexHelper.provider.getBalance('0x1928347619834761983764191827346198723646'));

                  // const senddTxn = await ts.simulate({
                  //   from: '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                  //   to: '0x1928347619834761983764191827346198723646', // undefined in case of contract deployment
                  //   value: '1234',
                  //   data: '',
                  // });

                  // const senddTxn2 = await ts.simulate({
                  //   from: '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                  //   to: '0x1928347619834761983764191827346198723646', // undefined in case of contract deployment
                  //   value: '1234',
                  //   data: '',
                  // });

                  // // console.log(JSON.stringify(senddTxn));

                  // console.log(JSON.stringify(ts));

                  // console.log("eth balance after sned : " + await dexHelper.provider.getBalance('0x1928347619834761983764191827346198723646'));
                  console.log(
                    'eth balance before : ' +
                      (await dexHelper.provider.getBalance(
                        '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                      )),
                  );

                  // const allowanceTxn = await ts.simulate({
                  //   from: '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                  //   to: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // undefined in case of contract deployment
                  //   value: '0',
                  //   data: '0x095ea7b30000000000000000000000006d83f60eeac0e50a1250760151e81db2a278e03a0000000000000000000000000000000000000000000000056bc75e2d63100000',
                  // });
                  const allowanceTxn = await ts.simulate({
                    from: '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                    to: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // undefined in case of contract deployment
                    value: '0',
                    data: '0x095ea7b30000000000000000000000006a000f20005980200259b80c51020030400010680000000000000000000000000000000000000000000000056bc75e2d63100000',
                  });

                  console.log(allowanceTxn);

                  // const swapTxn = await ts.simulate({
                  //   from: '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                  //   to: '0x6d83f60eeac0e50a1250760151e81db2a278e03a', // undefined in case of contract deployment
                  //   value: '0',
                  //   data: '0xba98fa1c00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000003c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                  // });
                  const swapTxn = await ts.simulate({
                    from: '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                    to: '0x6a000f20005980200259b80c5102003040001068', // undefined in case of contract deployment
                    value: '0',
                    data: '0xe3ead59e000000000000000000000000a600910b670804230e00a100000d28000ae005c00000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca0000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000103ab964e9ceb0100000000000000000000000000000000000000000000000001064b0ec65b454c0ae160924eed54e7abfa6d4ced59c2447000000000000000000000000013f7447000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000180000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001807f39c581f595b53c5cb19bd0b3f8da6c935e2ca00000006000000044ff00000000000000000000000000000000000000000000000000000000000000095ea7b30000000000000000000000006d83f60eeac0e50a1250760151e81db2a278e03affffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6d83f60eeac0e50a1250760151e81db2a278e03a000000a00024000000000007000000000000000000000000000000000000000000000000000000002668dfaa00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006a000f20005980200259b80c5102003040001068',
                  });

                  console.log(swapTxn);

                  console.log(
                    'eth balance after : ' +
                      (await dexHelper.provider.getBalance(
                        '0x3c22ec75ea5d745c78fc84762f7f1e6d82a2c5bf',
                      )),
                  );

                  const txnBlockNumber = swapTxn.transaction.block_number;

                  // const txnhash =
                  //   swapTxn.transaction.transaction_info.transaction_id;
                  // console.log(txnhash);

                  // console.log(
                  //   'retreiving txn : ' +
                  //     JSON.stringify(
                  //       await dexHelper.provider.getTransaction(
                  //         txnhash,
                  //       ),
                  //     ),
                  // );

                  console.log(fluidDexEventPool);

                  console.log(txnBlockNumber);

                  console.log(
                    'state 3 blocks before : ' +
                      JSON.stringify(
                        await fluidDexEventPool.generateState(
                          txnBlockNumber - 4,
                        ),
                        replacer,
                        2,
                      ),
                  );
                  console.log(
                    'state 2 blocks before : ' +
                      JSON.stringify(
                        await fluidDexEventPool.generateState(
                          txnBlockNumber - 3,
                        ),
                        replacer,
                        2,
                      ),
                  );
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

                  await delay(10000);

                  console.log(
                    'state 1 block after : ' +
                      JSON.stringify(
                        await fluidDexEventPool.generateState(txnBlockNumber),
                        replacer,
                        2,
                      ),
                  );

                  await testEventSubscriber(
                    fluidDexEventPool,
                    fluidDexEventPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(fluidDexEventPool, _blockNumber),
                    txnBlockNumber,
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

  // Object.entries(poolFetchEventsToTest).forEach(
  //   ([poolAddress, events]: [string, EventMappings]) => {
  //     describe(`Events for ${poolAddress}`, () => {
  //       Object.entries(events).forEach(
  //         ([eventName, blockNumbers]: [string, number[]]) => {
  //           describe(`${eventName}`, () => {
  //             blockNumbers.forEach((blockNumber: number) => {
  //               it(`State after ${blockNumber}`, async function () {
  //                 fluidDexCommonAddress = new FluidDexCommonAddresses(
  //                   'FluidDex',
  //                   fluidDexCommonAddressStruct,
  //                   network,
  //                   dexHelper,
  //                   logger,
  //                 );

  //                 await testEventSubscriber(
  //                   fluidDexCommonAddress,
  //                   fluidDexCommonAddress.addressesSubscribed,
  //                   (_blockNumber: number) =>
  //                     fetchTotalPools(fluidDexCommonAddress, _blockNumber),
  //                   blockNumber,
  //                   `${dexKey}_${poolAddress}`,
  //                   dexHelper.provider,
  //                 );
  //               });
  //             });
  //           });
  //         },
  //       );
  //     });
  //   },
  // );
});
