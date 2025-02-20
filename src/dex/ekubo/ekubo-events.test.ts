/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { BasePool } from './pools/base-pool';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { findNearestInitializedTickIndex, PoolKey, PoolState } from './types';
import { EkuboConfig } from './config';
import { Contract } from 'ethers';
import CoreABI from '../../abi/ekubo/core.json';
import DataFetcherABI from '../../abi/ekubo/data-fetcher.json';
import { Tokens } from '../../../tests/constants-e2e';
import { Interface } from '@ethersproject/abi';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  pool: BasePool,
  blockNumber: number,
): Promise<PoolState.Object> {
  return pool.generateState(blockNumber) as Promise<PoolState.Object>;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

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

describe('Ekubo Mainnet', function () {
  const dexKey = 'Ekubo';
  const network = Network.MAINNET;
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
  let pool: BasePool;

  const eventsToTest: EventMappings = {
    Swapped: [
      21796221, // https://etherscan.io/tx/0x6bb4c90f1ff6f81fc98973590f11968215cd3572c9b285197539d6776bdc4204
    ],
    PositionUpdated: [
      21802238, // https://etherscan.io/tx/0x0c978ec4226b73f7d1e718d93bb91a8e8dd27a7bb173b21b7d17823333e5221a
    ],
  };

  beforeEach(async () => {
    pool = new BasePool(
      dexKey,
      network,
      dexHelper,
      logger,
      core,
      coreIface,
      dataFetcher,
      new PoolKey(
        BigInt(Tokens[network].USDC.address),
        BigInt(Tokens[network].USDT.address),
        8507059173023461994257409214775295n,
        50,
        0n,
      ),
    );
  });

  Object.entries(eventsToTest).forEach(
    ([eventName, blockNumbers]: [string, number[]]) => {
      describe(`${eventName}`, () => {
        blockNumbers.forEach((blockNumber: number) => {
          it(`State after ${blockNumber}`, async function () {
            await testEventSubscriber(
              pool,
              pool.addressesSubscribed,
              (blockNumber: number) => fetchPoolState(pool, blockNumber),
              blockNumber,
              `${dexKey}_${pool.key.id()}`,
              dexHelper.provider,
              stateCompare,
            );
          });
        });
      });
    },
  );
});
