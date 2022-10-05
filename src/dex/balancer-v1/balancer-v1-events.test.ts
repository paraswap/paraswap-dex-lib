import dotenv from 'dotenv';
dotenv.config();

import { BalancerV1EventPool } from './balancer-v1-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState, PoolsInfo } from './types';
import { BalancerV1Config } from './config';
import BalancerCustomMulticallABI from '../../abi/BalancerCustomMulticall.json';

const balancerPools = require('./balancer-pools.json') as PoolsInfo;

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  balancerV1Pool: BalancerV1EventPool,
  blockNumber: number,
): Promise<PoolState> {
  return await balancerV1Pool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('BalancerV1 EventPool Mainnet', function () {
  const dexKey = 'BalancerV1';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  const balancerMulticall = new dexHelper.web3Provider.eth.Contract(
    BalancerCustomMulticallABI as any,
    BalancerV1Config[dexKey][network].multicallAddress,
  );

  // poolAddress -> EventMappings
  // poolAddress must be lowercased to match what's in the json file
  const eventsToTest: Record<Address, EventMappings> = {
    '0x49ff149d649769033d43783e7456f626862cd160': {
      LOG_JOIN: [15408118],
      LOG_EXIT: [15408123, 15408138, 15408247, 15408291, 15408327, 15408349],
      LOG_SWAP: [
        15407544, 15407571, 15407822, 15407828, 15407852, 15407999, 15408136,
        15408715, 15408896, 15408959, 15409162, 15409179, 15409261,
      ],
    },
  };

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  const balancerV1Pool = new BalancerV1EventPool(
                    dexKey,
                    network,
                    dexHelper,
                    logger,
                    balancerMulticall,
                    balancerPools.pools.find(p => p.id === poolAddress)!,
                  );
                  await testEventSubscriber(
                    balancerV1Pool,
                    balancerV1Pool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(balancerV1Pool, _blockNumber),
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
