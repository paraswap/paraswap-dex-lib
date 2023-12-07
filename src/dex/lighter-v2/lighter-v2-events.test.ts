/* eslint-disable no-console */
import dotenv from 'dotenv';

dotenv.config();

import { LighterV2EventPool } from './lighter-v2-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { DeepReadonly } from 'ts-essentials';
import { BI_POWS } from '../../bigint-constants';
import { Tokens } from '../../../tests/constants-e2e';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  lighterV2Pools: LighterV2EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<DeepReadonly<PoolState>> {
  return lighterV2Pools.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

const WETHUSDCe: EventMappings = {
  CreateOrder: [
    150021042, 150021278, 150021278, 150021516, 150021516, 150021750, 150021750,
    150021985, 150021985, 150022217, 150022217, 150022458, 150022458, 150022692,
    150022692, 150022926, 150022926, 150023163, 150023163, 150023383, 150023383,
    150023611, 150023611, 150023859, 150023859, 150024099, 150024099, 150024338,
    150024338, 150024576, 150024576, 150024811, 150024811, 150025049, 150025049,
    150025306, 150025306, 150025549, 150025549, 150025786, 150025786, 150026020,
    150026020, 150026258, 150026258, 150026497, 150026497, 150026748, 150026748,
    150026989, 150026989, 150027232, 150027232, 150027468, 150027468, 150027703,
    150027703, 150027943, 150027943, 150028182, 150028427, 150028667, 150028667,
    150028904, 150028904, 150029141, 150029141, 150029380, 150029380, 150029619,
    150029619, 150029869, 150029869, 150030108, 150030108, 150030347, 150030347,
    150030588, 150030588, 150030829, 150030829,
  ],
  CancelLimitOrder: [
    150021103, 150021103, 150021103, 150021175, 150021314, 150021338, 150021525,
    150021676, 150021782, 150021997, 150022169, 150022265, 150022468, 150022738,
    150022740, 150022918, 150023026, 150023030, 150023144, 150023208, 150023292,
    150023409, 150023662, 150023701, 150023830, 150023830, 150023908, 150023912,
    150024031, 150024125, 150024425, 150024601, 150024609, 150024860, 150025080,
    150025109, 150025285, 150025332, 150025481, 150025570, 150025573, 150025573,
    150025655, 150025834, 150026053, 150026199, 150026272, 150026411, 150026557,
    150026631, 150026773, 150026822, 150027005, 150027108, 150027281, 150027331,
    150027534, 150027757, 150027938, 150027968, 150028272, 150028588, 150028654,
    150028656, 150028684, 150028891, 150028914, 150029148, 150029274, 150029411,
    150029517, 150029523, 150029600, 150029656, 150029885, 150029913, 150029953,
    150030137, 150030239, 150030375, 150030615, 150030669, 150030836,
  ],
  PartialSwap: [
    151268471, 151269071, 151272596, 151325725, 151352760, 151406799, 151503260,
    151602829, 151707841, 151708337, 151855350, 151856622, 151898798, 151924020,
    151943598, 152180013, 152180466,
  ],
  FullSwaps: [151707487, 151143491],
};

describe('LighterV2 EventPool Arbitrum', function () {
  const dexKey = 'LighterV2';
  const network = Network.ARBITRUM;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let lighterV2Pool: LighterV2EventPool;

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0x33a5A405B97C6e77f3cA07a55FeF08454F5550bd': WETHUSDCe,
  };

  beforeEach(async () => {
    lighterV2Pool = new LighterV2EventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      '0x33a5A405B97C6e77f3cA07a55FeF08454F5550bd',
      0,
      Tokens[Network.ARBITRUM]['WETH'],
      Tokens[Network.ARBITRUM]['USDCe'],
      BI_POWS[12],
      BI_POWS[4],
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
                    lighterV2Pool,
                    lighterV2Pool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(lighterV2Pool, _blockNumber, poolAddress),
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
