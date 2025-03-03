/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import {
  findNearestInitializedTickIndex,
  PoolConfig,
  PoolKey,
  PoolState,
} from './types';
import { EkuboConfig } from './config';
import { Contract } from 'ethers';
import CoreABI from '../../abi/ekubo/core.json';
import DataFetcherABI from '../../abi/ekubo/data-fetcher.json';
import { Interface } from '@ethersproject/abi';
import { BasePool } from './pools/base-pool';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  pool: BasePool,
  blockNumber: number,
): Promise<PoolState.Object> {
  return pool.generateState(blockNumber) as Promise<PoolState.Object>;
}

type EventMappings = Record<string, [typeof BasePool, PoolKey, number][]>;

function stateCompare(actual: PoolState.Object, expected: PoolState.Object) {
  const [lowCheckedTickActual, highCheckedTickActual] =
    actual.checkedTicksBounds;
  const [lowCheckedTickExpected, highCheckedTickExpected] =
    expected.checkedTicksBounds;

  const [sameLowCheckedTicks, sameHighCheckedTicks] = [
    lowCheckedTickActual === lowCheckedTickExpected,
    highCheckedTickActual === highCheckedTickExpected,
  ];

  if (sameLowCheckedTicks && sameHighCheckedTicks) {
    expect(actual).toStrictEqual(expected);
    return;
  }

  expect(actual.sqrtRatio).toStrictEqual(expected.sqrtRatio);
  expect(actual.activeTick).toStrictEqual(expected.activeTick);
  expect(actual.liquidity).toStrictEqual(expected.liquidity);

  /**
   * The checked tick ranges differ between the two states at this point.
   * In order to still compare the tick arrays, we thus have to exclude the liquidity cutoff ticks
   * from the comparison (if they differ), as well as any other ticks that could've only
   * been discovered in one of the two checked tick ranges.
   */

  let lowTickIndexActual: number, lowTickIndexExpected: number;

  if (sameLowCheckedTicks) {
    [lowTickIndexActual, lowTickIndexExpected] = [0, 0];
  } else if (lowCheckedTickActual > lowCheckedTickExpected) {
    lowTickIndexActual = 1;
    lowTickIndexExpected =
      findNearestInitializedTickIndex(
        expected.sortedTicks,
        lowCheckedTickActual,
      )! + 1;
  } else {
    lowTickIndexExpected = 1;
    lowTickIndexActual =
      findNearestInitializedTickIndex(
        actual.sortedTicks,
        lowCheckedTickExpected,
      )! + 1;
  }

  let highTickIndexActual: number, highTickIndexExpected: number;

  if (sameHighCheckedTicks) {
    [highTickIndexActual, highTickIndexExpected] = [
      actual.sortedTicks.length,
      expected.sortedTicks.length,
    ];
  } else if (highCheckedTickActual > highCheckedTickExpected) {
    highTickIndexExpected = expected.sortedTicks.length - 1;

    let tickIndex = findNearestInitializedTickIndex(
      actual.sortedTicks,
      highCheckedTickExpected,
    )!;
    highTickIndexActual =
      actual.sortedTicks[tickIndex].number === highCheckedTickExpected
        ? tickIndex
        : tickIndex + 1;
  } else {
    highTickIndexActual = actual.sortedTicks.length - 1;

    let tickIndex = findNearestInitializedTickIndex(
      expected.sortedTicks,
      highCheckedTickActual,
    )!;
    highTickIndexExpected =
      expected.sortedTicks[tickIndex].number === highCheckedTickActual
        ? tickIndex
        : tickIndex + 1;
  }

  expect(
    actual.sortedTicks.slice(lowTickIndexActual, highTickIndexActual),
  ).toStrictEqual(
    expected.sortedTicks.slice(lowTickIndexExpected, highTickIndexExpected),
  );
}

const dexKey = 'Ekubo';

describe('Ekubo Sepolia', function () {
  const network = Network.SEPOLIA;
  const config = EkuboConfig[dexKey][network];
  const dexHelper = new DummyDexHelper(network);
  const core = new Contract(config.core, CoreABI, dexHelper.provider);
  const coreIface = new Interface(CoreABI);
  const dataFetcher = new Contract(
    config.dataFetcher,
    DataFetcherABI,
    dexHelper.provider,
  );
  const logger = dexHelper.getLogger(dexKey);

  const eventsToTest: EventMappings = {
    Swapped: [
      [
        BasePool,
        new PoolKey(
          0n,
          0xd876ec2ee0816c019cc54299a8184e8111694865n,
          PoolConfig.fromCompressed(
            0x00000000000000000000000000000000000000000020c49ba5e353f7000003e8n,
          ),
        ),
        7818258, // https://sepolia.etherscan.io/tx/0x39571b8569625ee326cc5ba71031ce82466a1256964eb840ec6165aea545f3a7
      ],
    ],
    PositionUpdated: [
      [
        BasePool,
        new PoolKey(
          0n,
          0xd876ec2ee0816c019cc54299a8184e8111694865n,
          PoolConfig.fromCompressed(
            0x00000000000000000000000000000000000000000020c49ba5e353f7000003e8n,
          ),
        ),
        7818239, // https://sepolia.etherscan.io/tx/0x4a0bdc9f301bbc398190b439991e0a3acc40841fe209b73563dbedbf04dfc40d
      ],
    ],
  };

  Object.entries(eventsToTest).forEach(([eventName, eventDetails]) => {
    describe(`${eventName}`, () => {
      eventDetails.forEach(([PoolType, poolKey, blockNumber]) => {
        it(`State of ${poolKey.string_id} after ${blockNumber}`, async function () {
          const pool = new PoolType(
            dexKey,
            network,
            dexHelper,
            logger,
            coreIface,
            dataFetcher,
            poolKey,
            core,
          );

          await testEventSubscriber(
            pool,
            pool.addressesSubscribed,
            (blockNumber: number) => fetchPoolState(pool, blockNumber),
            blockNumber,
            `${dexKey}_${pool.key.string_id}`,
            dexHelper.provider,
            stateCompare,
          );
        });
      });
    });
  });
});
