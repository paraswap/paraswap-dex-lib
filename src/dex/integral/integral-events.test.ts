/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import {
  IntegralFactory,
  OnPoolCreatedCallback,
} from '../integral/integral-factory';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import {
  FactoryState,
  PoolState,
  RelayerState,
  TokenState,
} from '../integral/types';
import { IntegralConfig } from './config';
import { IntegralEventPool } from './integral-pool';
import { Tokens } from '../../../tests/constants-e2e';
import { IntegralRelayer, OnPoolEnabledSetCallback } from './integral-relayer';
import ERC20ABI from '../../abi/erc20.json';
import { Interface } from 'ethers/lib/utils';
import { updateEventSubscriber, checkEventSubscriber } from './utils-e2e';
import { IntegralToken } from './integral-token';
import { IntegralContext } from './context';

jest.setTimeout(50 * 1000);
const dexKey = 'Integral';
const network = Network.MAINNET;
const dexHelper = new DummyDexHelper(network);
const logger = dexHelper.getLogger(dexKey);
const erc20Interface = new Interface(ERC20ABI);

const TEST_POOL_ADDRESS = '0x6ec472b613012a492693697FA551420E60567eA7'; // usdc-usdt pool address
const _TEST_POOLS = {
  ['0x6ec472b613012a492693697FA551420E60567eA7']: ['USDC', 'USDT'],
  ['0x2fe16Dd18bba26e457B7dD2080d5674312b026a2']: ['WETH', 'USDC'],
  ['0x048f0e7ea2CFD522a4a058D1b1bDd574A0486c46']: ['WETH', 'USDT'],
  ['0x37F6dF71b40c50b2038329CaBf5FDa3682Df1ebF']: ['WETH', 'WBTC'],
  ['0x29b57D56a114aE5BE3c129240898B3321A70A300']: ['WETH', 'wstETH'],
  ['0x61fA1CEe13CEEAF20C30611c5e6dA48c595F7dB2']: [
    'WETH',
    '0xD33526068D116cE69F19A9ee46F0bd304F21A51f',
  ], // RPL
  ['0x045950A37c59d75496BB4Af68c05f9066A4C7e27']: [
    'WETH',
    '0x48C3399719B582dD63eB5AADf12A40B4C3f52FA2',
  ], // SWISE
  ['0xbEE7Ef1adfaa628536Ebc0C1EBF082DbDC27265F']: [
    'WETH',
    '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
  ], // LDO
};
const TEST_POOLS = initTestPools();
const dummyCallback = () => {};

function initTestPools() {
  return Object.entries(_TEST_POOLS).reduce<{
    [poolAddress: Address]: { token0: Address; token1: Address };
  }>((memo, [poolAddress, [symbolA, symbolB]]) => {
    const tokenA =
      (Tokens[network][symbolA] &&
        Tokens[network][symbolA].address.toLowerCase()) ||
      symbolA.toLowerCase();
    const tokenB =
      (Tokens[network][symbolB] &&
        Tokens[network][symbolB].address.toLowerCase()) ||
      symbolB.toLowerCase();
    const [token0, token1] =
      tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
    memo[poolAddress] = { token0, token1 };
    return memo;
  }, {});
}

async function fetchFactoryState(
  integralFactory: IntegralFactory,
  blockNumber: number,
  factoryAddress: string,
): Promise<FactoryState> {
  const message = `Integral Factory: ${factoryAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  return integralFactory.generateState(blockNumber);
}

async function fetchPoolState(
  integralPool: IntegralEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `Integral Pool: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  return integralPool.generateState(blockNumber);
}

async function fetchTokenState(
  integralToken: IntegralToken,
  blockNumber: number,
  tokenAddress: string,
): Promise<TokenState> {
  const message = `ERC20 Token: ${tokenAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  return integralToken.generateState();
}

async function fetchRelayerState(
  integralRelayer: IntegralRelayer,
  blockNumber: number,
  relayerAddress: string,
): Promise<RelayerState> {
  const message = `Integral Relayer: ${relayerAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  return integralRelayer.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Integral Factory Events Mainnet', function () {
  const onPoolCreated: OnPoolCreatedCallback =
    dummyCallback as unknown as OnPoolCreatedCallback;
  let integralFactory: IntegralFactory;

  const factoryAddress =
    IntegralConfig[dexKey][network].factoryAddress.toLowerCase();
  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    [factoryAddress]: {
      PairCreated: [
        14423189, 14538708, 14722391, 15001878, 16638150, 17022679, 17333304,
        19011983, 19011987, 19011992, 19012000, 19483224, 19483230, 19483234,
        19483237,
      ],
    },
  };

  beforeEach(async () => {
    integralFactory = new IntegralFactory(
      dexHelper,
      dexKey,
      factoryAddress,
      onPoolCreated,
      logger,
    );
  });

  Object.entries(eventsToTest).forEach(
    ([factoryAddress, events]: [string, EventMappings]) => {
      describe(`Events for Factory: ${factoryAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await testEventSubscriber<FactoryState>(
                    integralFactory,
                    integralFactory.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchFactoryState(
                        integralFactory,
                        _blockNumber,
                        factoryAddress,
                      ),
                    blockNumber,
                    `${dexKey}_${factoryAddress}`,
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

describe('Integral Pool Events Mainnet', function () {
  let integralPool: IntegralEventPool;

  const eventsToTest: Record<Address, EventMappings> = {
    [TEST_POOL_ADDRESS]: {
      SetSwapFee: [17022687],
      SetMintFee: [],
      SetBurnFee: [],
    },
  };

  beforeEach(async () => {
    integralPool = new IntegralEventPool(
      dexKey,
      network,
      dexHelper,
      TEST_POOL_ADDRESS,
      TEST_POOLS[TEST_POOL_ADDRESS].token0,
      TEST_POOLS[TEST_POOL_ADDRESS].token1,
      logger,
    );
  });

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for Pool: ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await testEventSubscriber<PoolState>(
                    integralPool,
                    integralPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(integralPool, _blockNumber, poolAddress),
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

describe('Integral Relayer Events Mainnet', function () {
  let integralRelayer: IntegralRelayer;
  const onPoolEnabledSet = dummyCallback as unknown as OnPoolEnabledSetCallback;
  const relayerAddress =
    IntegralConfig[dexKey][network].relayerAddress.toLowerCase();

  const eventsToTest: Record<Address, EventMappings> = {
    [relayerAddress]: {
      SwapFeeSet: [19460786],
      PairEnabledSet: [19133248, 19488170, 19488805],
      UnwrapWeth: [
        19117714, 19216294, 19272845, 19326496, 19361829, 19389103, 19430619,
        19473032, 19565232, 19632898, 19660246, 19757979,
      ],
      WrapEth: [],
    },
  };

  beforeEach(async () => {
    integralRelayer = new IntegralRelayer(
      dexHelper,
      dexKey,
      erc20Interface,
      relayerAddress,
      TEST_POOLS,
      onPoolEnabledSet,
      logger,
    );
  });

  Object.entries(eventsToTest).forEach(
    ([relayerAddress, events]: [string, EventMappings]) => {
      describe(`Events for Relayer: ${relayerAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await testEventSubscriber<RelayerState>(
                    integralRelayer,
                    integralRelayer.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchRelayerState(
                        integralRelayer,
                        _blockNumber,
                        relayerAddress,
                      ),
                    blockNumber,
                    `${dexKey}_${relayerAddress}`,
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

describe('Integral Multiple Events Mainnet', function () {
  let context: IntegralContext;
  const onPoolEnabledSet = dummyCallback as unknown as OnPoolEnabledSetCallback;
  const relayerAddress =
    IntegralConfig[dexKey][network].relayerAddress.toLowerCase();

  const eventsToTest: Record<Address, EventMappings> = {
    ['']: {
      Transfer: [
        18490280, 18567011, 18633511, 18713381, 18764112, 18831592, 18912551,
        19016598, 19117714, 19216294, 19241751, 19272845, 19326496, 19361829,
        19389103, 19430619, 19430725, 19473032, 19565232, 19632898, 19660246,
        19696426, 19701836, 19703192, 19709820, 19711173, 19715839, 19717874,
        19723287, 19724410, 19728665, 19733351, 19735237, 19738144, 19739161,
        19748150, 19748662, 19749146, 19752286, 19754012, 19757979, 19760993,
      ],
    },
  };

  beforeEach(async () => {
    context = IntegralContext.initialize(
      network,
      'Integral',
      dexHelper,
      erc20Interface,
      IntegralConfig[dexKey][network].factoryAddress.toLowerCase(),
      IntegralConfig[dexKey][network].relayerAddress.toLowerCase(),
    );
    const onTransfer = (
      token: Address,
      from: Address,
      to: Address,
      amount: bigint,
      blockNumber: number,
    ) => context.onTransferUpdateBalance(token, from, to, amount, blockNumber);
    const tokensMap = Object.values(TEST_POOLS).reduce<{
      [tokenAddress: Address]: null;
    }>((memo, { token0, token1 }) => {
      memo[token0.toLowerCase()] = null;
      memo[token1.toLowerCase()] = null;
      return memo;
    }, {});
    Object.keys(tokensMap).map(tokenAddress => {
      context.tokens[tokenAddress] = new IntegralToken(
        network,
        dexHelper,
        dexKey,
        erc20Interface,
        tokenAddress,
        relayerAddress,
        onTransfer,
        logger,
      );
    });

    const integralRelayer = new IntegralRelayer(
      dexHelper,
      dexKey,
      erc20Interface,
      relayerAddress.toLowerCase(),
      TEST_POOLS,
      onPoolEnabledSet,
      logger,
    );
    context.relayer = integralRelayer;
  });

  Object.entries(eventsToTest).forEach(
    ([_, events]: [string, EventMappings]) => {
      describe(`Events for Pool & Relayer`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await updateEventSubscriber<RelayerState>(
                    context.relayer,
                    context.relayer.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchRelayerState(
                        context.relayer,
                        _blockNumber,
                        relayerAddress,
                      ),
                    blockNumber,
                    `${dexKey}_${relayerAddress}`,
                    dexHelper.provider,
                  );
                  const tokenArray = Object.values(context.tokens);
                  await Promise.all(
                    tokenArray.map(async t =>
                      updateEventSubscriber<TokenState>(
                        t,
                        t.addressesSubscribed,
                        (_blockNumber: number) =>
                          fetchTokenState(t, _blockNumber, t.tokenAddress),
                        blockNumber,
                        `${dexKey}_${t.tokenAddress}`,
                        dexHelper.provider,
                      ),
                    ),
                  );
                  await checkEventSubscriber<RelayerState>(
                    context.relayer,
                    (_blockNumber: number) =>
                      fetchRelayerState(
                        context.relayer,
                        _blockNumber,
                        relayerAddress,
                      ),
                    blockNumber,
                    `${dexKey}_${relayerAddress}`,
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
