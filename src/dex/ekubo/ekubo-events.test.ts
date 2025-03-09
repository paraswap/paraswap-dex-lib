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
import { OraclePool } from './pools/oracle-pool';

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

  const basePoolKeyErc20 = new PoolKey(
    0xd876ec2ee0816c019cc54299a8184e8111694865n,
    0xf7b3e9697fd769104cd6cf653c179fb452505a3en,
    new PoolConfig(1000, 9223372036854775n, 0n),
  );

  const basePoolKeyEth = new PoolKey(
    0n,
    0xd876ec2ee0816c019cc54299a8184e8111694865n,
    new PoolConfig(1000, 9223372036854775n, 0n),
  );

  const oraclePoolKey = new PoolKey(
    0n,
    0xd876ec2ee0816c019cc54299a8184e8111694865n,
    new PoolConfig(0, 0n, BigInt(config.oracle)),
  );

  const eventsToTest: EventMappings = {
    Swapped: [
      [
        BasePool,
        basePoolKeyErc20,
        7852238, // ERC20 -> ERC20 exact in https://sepolia.etherscan.io/tx/0xd331ee9950e326da0aa886efb8015c82a2b64d6be4ebf0fefba0b8a7eab72fb3
      ],
      [
        BasePool,
        basePoolKeyErc20,
        7852286, // ERC20 -> ERC20 exact out https://sepolia.etherscan.io/tx/0xdca418e6a533c7c53b9a3978c415bac8c594776f82d1848e425a10621682f461
      ],
      [
        OraclePool,
        oraclePoolKey,
        7852093, // ETH -> ERC20 exact in https://sepolia.etherscan.io/tx/0xbaae6f57ac970040b9ee5b0be7dd4dd1b0ffdf4c12fa46eead6e7ac0572def36
      ],
      [
        OraclePool,
        oraclePoolKey,
        7852249, // ERC20 -> ETH exact in https://sepolia.etherscan.io/tx/0xf7da9b5d546c0addc6fb098d12250f07d095ef7cfb8ad7d380afe00c3c5d00bd
      ],
      [
        OraclePool,
        oraclePoolKey,
        7852257, // ETH -> ERC20 exact out https://sepolia.etherscan.io/tx/0xa47db956f2ac1f52c20abe39ef79ca2ba39a960226a41805145b6eb110a5c17d
      ],
      [
        OraclePool,
        oraclePoolKey,
        7852195, // ERC20 -> ETH exact out https://sepolia.etherscan.io/tx/0x0392edafcc19b6fe235e0e3f69f3a78a4dc8ebb2c2ac2f6290e013b2533c0591
      ],
    ],
    PositionUpdated: [
      [
        BasePool,
        basePoolKeyErc20,
        7851654, // Add liquidity to position https://sepolia.etherscan.io/tx/0x0445c655492d86388077f5d02799cd9c183ca5149aada61d4a37e826745e870f
      ],
      [
        BasePool,
        basePoolKeyErc20,
        7852339, // Remove liquidity from position https://sepolia.etherscan.io/tx/0x1f95cd406393561a22f951e34d8dfb599559f084ba6beb4cc992653e0eba82c1
      ],
      [
        BasePool,
        basePoolKeyEth,
        7852323, // Add liquidity to position https://sepolia.etherscan.io/tx/0xad69ff84bc143f8377b478396d94f0c4f0d595156c26fdbf3813ad0cb4d676ed
      ],
      [
        BasePool,
        basePoolKeyEth,
        7852330, // Remove liquidity from position https://sepolia.etherscan.io/tx/0x58f70e9c441267779c46d182de4baf637eb87b34f5b4b257a0fa45c255adb00d
      ],
      [
        OraclePool,
        oraclePoolKey,
        7851662, // Add liquidity to position https://sepolia.etherscan.io/tx/0x11893f22c56e1f114311edcf23ebb8751f4202a5f7fe9e7a79295b6fd3e263ba
      ],
      [
        OraclePool,
        oraclePoolKey,
        7852343, // Remove liquidity from position https://sepolia.etherscan.io/tx/0xb012023d769498db4759475fbfb0ace46585178a9344840e951387a055c0efc1
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
