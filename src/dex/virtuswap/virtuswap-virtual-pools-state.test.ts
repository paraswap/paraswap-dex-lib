/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { VirtuSwapConfig } from './config';
import { PlainVirtualPoolState } from './types';
import { getVirtualPool, getVirtualPools } from './lib/vSwapLibrary';
import { computeAddress } from './lib/PoolAddress';
import { VirtuSwapVirtualPoolManager } from './virtuswap-virtual-pool-manager';
import { VirtuSwapEventPool } from './virtuswap-pool';
import { normalizeAddress } from '../../utils';

jest.setTimeout(50 * 1000);

type PairOfPools = {
  jkPair: Address;
  ikPair: Address;
  validBlockNumbers: number[];
  invalidBlockNumbers: { [reason: string]: number[] };
};

type PairOfTokens = {
  token0: Address;
  token1: Address;
  validBlockNumbers: number[];
};

const dexKey = 'VirtuSwap';

describe('VirtuSwap Virtual Pools by Pairs', function () {
  const poolsToTest: Partial<Record<Network, PairOfPools[]>> = {
    [Network.POLYGON]: [
      {
        jkPair: '0x68BfaE97d4970ba6f542c2a93Ed2e6eDBBf96c3b', // VRSW-WETH
        ikPair: '0xa28AA39A9F3A46b20026b80F73fc8ae05290f6DA', // USDC.e-VRSW
        validBlockNumbers: [
          55672577 - 1,
          55674148 - 1,
          55843818 - 1,
          55847147 - 1,
        ], // -1 as we need to check state before events
        invalidBlockNumbers: {
          'VSWAP: LOCKED_VPOOL': [55843818, 55847147, 55847147 + 1],
        },
      },
      {
        jkPair: '0x68BfaE97d4970ba6f542c2a93Ed2e6eDBBf96c3b', // VRSW-WETH
        ikPair: '0x0298BAa90C7a8d13037276C4D0c7422dB13D206e', // WBTC-WETH
        validBlockNumbers: [
          55672577 - 1,
          55674148 - 1,
          55739830 - 1,
          55846513 - 1,
        ], // -1 as we need to check state before events
        invalidBlockNumbers: {},
      },
      {
        jkPair: '0x0298BAa90C7a8d13037276C4D0c7422dB13D206e', // WBTC-WETH
        ikPair: '0x5C4281D26bE6853A132794429CDfAbaC6F652Ad6', // DECATS-VRSW
        validBlockNumbers: [],
        invalidBlockNumbers: {
          'VSWAP: INVALID_VPOOL': [55854967],
        },
      },
      {
        jkPair: '0x68BfaE97d4970ba6f542c2a93Ed2e6eDBBf96c3b', // VRSW-WETH
        ikPair: '0x5C4281D26bE6853A132794429CDfAbaC6F652Ad6', // DECATS-VRSW
        validBlockNumbers: [],
        invalidBlockNumbers: {
          'VSWAP: NOT_ALLOWED': [55854967],
        },
      },
    ],
    [Network.ARBITRUM]: [
      {
        jkPair: '0x8431aAaa1bB7BD11d4740F19a0306e00b7eDB817', // WETH-VRSW
        ikPair: '0xD7d90067A07620EdEc49665B5703E539811aeb17', // VRSW-USDC.e
        validBlockNumbers: [
          196701768 - 1,
          199497388 - 1,
          199819683 - 1,
          201211164 - 1,
          201254592 - 1,
        ], // -1 as we need to check state before events
        invalidBlockNumbers: {
          'VSWAP: LOCKED_VPOOL': [199819683, 199819683 + 1],
        },
      },
      {
        jkPair: '0xD7d90067A07620EdEc49665B5703E539811aeb17', // VRSW-USDC.e
        ikPair: '0x05f95b911A4C3CD571d9A8b05e86f3FBbE10593A', // wstETH-WETH
        validBlockNumbers: [],
        invalidBlockNumbers: {
          'VSWAP: INVALID_VPOOL': [201309231],
        },
      },
      {
        jkPair: '0x8431aAaa1bB7BD11d4740F19a0306e00b7eDB817', // WETH-VRSW
        ikPair: '0x05f95b911A4C3CD571d9A8b05e86f3FBbE10593A', // wstETH-WETH
        validBlockNumbers: [],
        invalidBlockNumbers: {
          'VSWAP: NOT_ALLOWED': [201309231],
        },
      },
    ],
  };

  Object.entries(poolsToTest).forEach(([networkId, pairsOfPools]) => {
    describe(`Network id: ${networkId}`, () => {
      const network = parseInt(networkId) as Network;
      const params = VirtuSwapConfig[dexKey][network];
      const dexHelper = new DummyDexHelper(network);
      dexHelper.web3Provider.eth.handleRevert = true; // we need revert strings to test errors
      const logger = dexHelper.getLogger(dexKey);
      const poolManager = new VirtuSwapVirtualPoolManager(
        dexHelper,
        logger,
        params.vPoolManagerAddress,
      );
      pairsOfPools.forEach(pairOfPools => {
        describe(`Virtual pool between jkPair=${pairOfPools.jkPair}, ikPair=${pairOfPools.ikPair}`, () => {
          const jkPool = new VirtuSwapEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            params.isTimestampBased,
            pairOfPools.jkPair,
          );
          const ikPool = new VirtuSwapEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            params.isTimestampBased,
            pairOfPools.ikPair,
          );
          pairOfPools.validBlockNumbers.forEach((blockNumber: number) => {
            it(`State after ${blockNumber}`, async function () {
              const onChainData = await poolManager.getVirtualPoolFromChain(
                pairOfPools.jkPair,
                pairOfPools.ikPair,
                blockNumber,
              );

              const jkPoolData = await jkPool.generateState(blockNumber);
              const ikPoolData = await ikPool.generateState(blockNumber);

              const block = await dexHelper.provider.getBlock(blockNumber);
              const blockTimestamp = block.timestamp;

              const computedData = getVirtualPool(
                jkPoolData,
                ikPoolData,
                params.isTimestampBased ? blockTimestamp : blockNumber,
              );

              const plainComputedData = {
                ...computedData,
                jkPair: normalizeAddress(pairOfPools.jkPair),
                ikPair: normalizeAddress(pairOfPools.ikPair),
              } as PlainVirtualPoolState;

              expect(plainComputedData).toEqual(onChainData);
            });
          });
          Object.entries(pairOfPools.invalidBlockNumbers).forEach(
            ([reason, blockNumbers]) => {
              describe(`Error reason: ${reason}`, () => {
                blockNumbers.forEach((blockNumber: number) => {
                  it(`State after ${blockNumber}`, async function () {
                    const onChainError = await poolManager
                      .getVirtualPoolFromChain(
                        pairOfPools.jkPair,
                        pairOfPools.ikPair,
                        blockNumber,
                      )
                      .catch((e: Error) => e);

                    expect(onChainError).toBeInstanceOf(Error);
                    expect((onChainError as Error).message).toEqual(
                      expect.stringContaining(reason),
                    );

                    const jkPoolData = await jkPool.generateState(blockNumber);
                    const ikPoolData = await ikPool.generateState(blockNumber);

                    const block = await dexHelper.provider.getBlock(
                      blockNumber,
                    );
                    const blockTimestamp = block.timestamp;

                    let wasErrorThrown = false;

                    try {
                      getVirtualPool(
                        jkPoolData,
                        ikPoolData,
                        params.isTimestampBased ? blockTimestamp : blockNumber,
                      );
                    } catch (calculationError: any) {
                      wasErrorThrown = true;
                      expect(calculationError).toBeInstanceOf(Error);
                      expect((calculationError as Error).message).toEqual(
                        expect.stringContaining(reason),
                      );
                    }
                    expect(wasErrorThrown).toBeTruthy();
                  });
                });
              });
            },
          );
        });
      });
    });
  });
});

describe('VirtuSwap Virtual Pools by Tokens', function () {
  const poolsToTest: Partial<Record<Network, PairOfTokens[]>> = {
    [Network.POLYGON]: [
      {
        token0: '0x57999936fC9A9EC0751a8D146CcE11901Be8beD0', // VRSW
        token1: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
        validBlockNumbers: [55854967],
      },
      {
        token0: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e
        token1: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
        validBlockNumbers: [55861452],
      },
    ],
    [Network.ARBITRUM]: [
      {
        token0: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
        token1: '0xd1E094CabC5aCB9D3b0599C3F76f2D01fF8d3563', // VRSW
        validBlockNumbers: [201309231],
      },
    ],
  };

  Object.entries(poolsToTest).forEach(([networkId, pairsOfPools]) => {
    describe(`Network id: ${networkId}`, () => {
      const network = parseInt(networkId) as Network;
      const params = VirtuSwapConfig[dexKey][network];
      const dexHelper = new DummyDexHelper(network);
      dexHelper.web3Provider.eth.handleRevert = true; // we need revert strings to test errors
      const logger = dexHelper.getLogger(dexKey);
      const poolManager = new VirtuSwapVirtualPoolManager(
        dexHelper,
        logger,
        params.vPoolManagerAddress,
      );
      pairsOfPools.forEach(pairOfTokens => {
        describe(`Virtual pool with token0=${pairOfTokens.token0}, token1=${pairOfTokens.token1}`, () => {
          pairOfTokens.validBlockNumbers.forEach((blockNumber: number) => {
            it(`State after ${blockNumber}`, async function () {
              const onChainData = await poolManager.getVirtualPoolsFromChain(
                pairOfTokens.token0,
                pairOfTokens.token1,
                blockNumber,
              );

              const poolsAddressesSet = new Set(
                onChainData.flatMap(pool => [pool.jkPair, pool.ikPair]),
              );
              const poolsAddresses = Array.from(poolsAddressesSet);
              const pools = poolsAddresses.map(
                poolAddress =>
                  new VirtuSwapEventPool(
                    dexKey,
                    network,
                    dexHelper,
                    logger,
                    params.isTimestampBased,
                    poolAddress,
                  ),
              );

              const poolsData = await Promise.all(
                pools.map(pool => pool.generateState(blockNumber)),
              );

              const block = await dexHelper.provider.getBlock(blockNumber);
              const blockTimestamp = block.timestamp;

              const computedData = getVirtualPools(
                poolsData,
                params.isTimestampBased ? blockTimestamp : blockNumber,
                normalizeAddress(pairOfTokens.token0),
                normalizeAddress(pairOfTokens.token1),
              );

              const plainComputedData = computedData.map(
                data =>
                  ({
                    ...data,
                    jkPair: normalizeAddress(
                      computeAddress(
                        params.factoryAddress,
                        data.jkPair.token0,
                        data.jkPair.token1,
                        params.initCode,
                      ),
                    ),
                    ikPair: normalizeAddress(
                      computeAddress(
                        params.factoryAddress,
                        data.ikPair.token0,
                        data.ikPair.token1,
                        params.initCode,
                      ),
                    ),
                  } as PlainVirtualPoolState),
              );

              expect(plainComputedData).toEqual(onChainData);
            });
          });
        });
      });
    });
  });
});
