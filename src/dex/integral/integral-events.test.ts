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
import { onTransferUpdateBalance } from './helpers';
// import {
//   updateEventSubscriber,
//   checkEventSubscriber,
// } from './tests/utils-events';
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
  let context: IntegralContextTest;
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
        19761502, 19768592, 19770633, 19773869, 19774874, 19776897, 19776905,
        19777396, 19782027, 19783245, 19787735, 19788241, 19789955, 19791466,
        19793053, 19793061, 19793780, 19794272, 19794281, 19794289, 19794773,
        19795346, 19795425, 19795435, 19795444, 19795464, 19795468, 19795572,
        19795580, 19795622, 19795773, 19795777, 19795831, 19795875, 19795886,
        19795962, 19796005, 19796069, 19796232, 19796233, 19796234, 19796386,
        19796563, 19796612, 19796613, 19796698, 19796829, 19796839, 19796842,
        19797051, 19797061, 19797219, 19797227, 19797230, 19797511, 19797537,
        19797546, 19797554, 19797574, 19797672, 19797836, 19797922, 19798001,
        19798043, 19798047, 19798051, 19798057, 19798124, 19798218, 19798354,
        19798447, 19798513, 19798547, 19798602, 19798734, 19798856, 19798935,
        19799058, 19799063, 19799066, 19799153, 19799177, 19799244, 19799323,
        19799350, 19799418, 19799463, 19799605, 19799625, 19799764, 19799832,
        19799833, 19799845, 19799896, 19799897, 19799907, 19799980, 19800011,
        19800169, 19800324, 19800555, 19800657, 19800794, 19800796, 19800816,
        19800868, 19801069, 19801083, 19801353, 19801525, 19801609, 19801650,
        19801686, 19801779, 19801845, 19801921, 19801929, 19801965, 19802092,
        19802184, 19802315, 19802334, 19802762, 19802797, 19802822, 19802836,
        19802837, 19802841, 19802886, 19802923, 19803364, 19803407, 19803528,
        19803633, 19803759, 19803765, 19803852, 19803854, 19803933, 19804429,
        19804437,
      ],
    },
  };

  //   beforeEach(async () => {
  //     context = new IntegralContextTest(
  //       {},
  //       {} as IntegralRelayer,
  //       relayerAddress,
  //     );
  //     const onTransfer = (
  //       token: Address,
  //       from: Address,
  //       to: Address,
  //       amount: bigint,
  //       blockNumber: number,
  //     ) =>
  //       onTransferUpdateBalance(
  //         token,
  //         from,
  //         to,
  //         amount,
  //         blockNumber,
  //         context as unknown as IntegralContext,
  //       );
  //     const tokensMap = Object.values(TEST_POOLS).reduce<{
  //       [tokenAddress: Address]: null;
  //     }>((memo, { token0, token1 }) => {
  //       memo[token0.toLowerCase()] = null;
  //       memo[token1.toLowerCase()] = null;
  //       return memo;
  //     }, {});
  //     Object.keys(tokensMap).map(tokenAddress => {
  //       context.tokens[tokenAddress] = new IntegralToken(
  //         dexHelper,
  //         dexKey,
  //         erc20Interface,
  //         tokenAddress,
  //         relayerAddress,
  //         onTransfer,
  //         logger,
  //       );
  //     });

  //     const integralRelayer = new IntegralRelayer(
  //       dexHelper,
  //       dexKey,
  //       erc20Interface,
  //       relayerAddress.toLowerCase(),
  //       TEST_POOLS,
  //       onPoolEnabledSet,
  //       logger,
  //     );
  //     context.relayer = integralRelayer;
  //   });

  //   // Object.entries(eventsToTest).forEach(
  //   //   ([_, events]: [string, EventMappings]) => {
  //   //     describe(`Events for Pool & Relayer`, () => {
  //   //       Object.entries(events).forEach(
  //   //         ([eventName, blockNumbers]: [string, number[]]) => {
  //   //           describe(`${eventName}`, () => {
  //   //             blockNumbers.forEach((blockNumber: number) => {
  //   //               it(`State after ${blockNumber}`, async function () {
  //   //                 await updateEventSubscriber<RelayerState>(
  //   //                   context.relayer,
  //   //                   context.relayer.addressesSubscribed,
  //   //                   (_blockNumber: number) =>
  //   //                     fetchRelayerState(
  //   //                       context.relayer,
  //   //                       _blockNumber,
  //   //                       relayerAddress,
  //   //                     ),
  //   //                   blockNumber,
  //   //                   `${dexKey}_${relayerAddress}`,
  //   //                   dexHelper.provider,
  //   //                 );
  //   //                 const tokenArray = Object.values(context.tokens);
  //   //                 await Promise.all(
  //   //                   tokenArray.map(async t =>
  //   //                     updateEventSubscriber<TokenState>(
  //   //                       t,
  //   //                       t.addressesSubscribed,
  //   //                       (_blockNumber: number) =>
  //   //                         fetchTokenState(t, _blockNumber, t.tokenAddress),
  //   //                       blockNumber,
  //   //                       `${dexKey}_${t.tokenAddress}`,
  //   //                       dexHelper.provider,
  //   //                     ),
  //   //                   ),
  //   //                 );
  //   //                 await checkEventSubscriber<RelayerState>(
  //   //                   context.relayer,
  //   //                   (_blockNumber: number) =>
  //   //                     fetchRelayerState(
  //   //                       context.relayer,
  //   //                       _blockNumber,
  //   //                       relayerAddress,
  //   //                     ),
  //   //                   blockNumber,
  //   //                   `${dexKey}_${relayerAddress}`,
  //   //                 );
  //   //               });
  //   //             });
  //   //           });
  //   //         },
  //   //       );
  //   //     });
  //   //   },
  //   // );
});

class IntegralContextTest {
  constructor(
    public tokens: { [tokenAddress: Address]: IntegralToken },
    public relayer: IntegralRelayer,
    public relayerAddress: Address,
  ) {}
}
