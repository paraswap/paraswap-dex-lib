/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { LighterV1EventPool } from './lighter-v1-pool';
import { Network } from '../../constants';
import { Address, Token } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { Tokens } from '../../../tests/constants-e2e';
import { bigIntify } from '../../utils';
import { DeepReadonly } from 'ts-essentials';
jest.setTimeout(50 * 1000);

async function fetchPoolState(
  lighterV1Pool: LighterV1EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<DeepReadonly<PoolState>> {
  return await lighterV1Pool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

const WETHUSDC: EventMappings = {
  LimitOrderCreated: [
    114787446, 114787446, 114787527, 114787527, 114787609, 114787768, 114787849,
    114788013, 114788093, 114788093, 114788093, 114788093, 114788179, 114788264,
    114788264, 114788344, 114788346, 114788427, 114788427, 114788516, 114788516,
    114788593, 114788593, 114788652, 114788674, 114788755, 114788755, 114788755,
    114788755, 114788838, 114788920, 114789001, 114789001, 114789157, 114789157,
    114789319, 114789319, 114789406, 114789406, 114789406, 114789406, 114789494,
    114789651, 114789651, 114789733, 114789733, 114789813, 114789891, 114790051,
    114790051, 114790123, 114790202, 114790202, 114790359, 114790597, 114790678,
    114790830, 114790917, 114790917, 114791068, 114791457, 114791614, 114791695,
    114791863, 114792176,
  ],
  Swap: [
    114787371, 114787504, 114788166, 114788536, 114788601, 114788851, 114790044,
    114792123,
  ],
  LimitOrderCanceled: [
    114787337, 114787337, 114787382, 114787475, 114787663, 114787757, 114787895,
    114787993, 114787993, 114787993, 114787993, 114788177, 114788177, 114788227,
    114788344, 114788371, 114788371, 114788371, 114788371, 114788465, 114788465,
    114788465, 114788465, 114788648, 114788648, 114788652, 114788695, 114788695,
    114788695, 114788746, 114788884, 114788884, 114789073, 114789073, 114789260,
    114789260, 114789260, 114789355, 114789355, 114789355, 114789355, 114789355,
    114789552, 114789552, 114789597, 114789597, 114789693, 114789834, 114789973,
    114789973, 114789973, 114790067, 114790155, 114790155, 114790246, 114790480,
    114790623, 114790717, 114790805, 114790853, 114790953, 114791407, 114791500,
    114791640, 114791783, 114792245,
  ],
};

// initialzie the events to test with above block numbers

describe('LighterV1 EventPool Arbitrum', function () {
  const dexKey = 'LighterV1';
  const network = Network.ARBITRUM;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let lighterV1Pool: LighterV1EventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0xB8Df652Ccb5CB39Ac1cD98a899639F8463B103a8': WETHUSDC,
  };

  beforeEach(async () => {
    const baseToken: Token = {
      address: Tokens[network].WETH.address,
      decimals: Tokens[network].WETH.decimals,
      symbol: Tokens[network].WETH.symbol,
    };

    const quoteToken: Token = {
      address: Tokens[network].USDC.address,
      decimals: Tokens[network].USDC.decimals,
      symbol: Tokens[network].USDC.symbol,
    };
    // create pool
    lighterV1Pool = new LighterV1EventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      '0x35642792abC96fA1E9fFe5F2f62A539bB80a8AF4',
      '0x033c00fd922AF40b6683Fe5371380831a5b81D57',
      0,
      '0xB8Df652Ccb5CB39Ac1cD98a899639F8463B103a8',
      baseToken,
      quoteToken,
      bigIntify(14),
    );
  });

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await testEventSubscriber(
                    lighterV1Pool,
                    lighterV1Pool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(lighterV1Pool, _blockNumber, poolAddress),
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
