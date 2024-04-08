import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { getTokenFromIdleSymbol, setTokensOnNetwork } from './tokens';
import { generateConfig } from '../../config';
import { fetchTokenList } from './utils';
import { DummyDexHelper } from '../../dex-helper';
import POOL_ABI from '../../abi/idle-dao/idle-cdo.json';
import ERC20ABI from '../../abi/erc20.json';
import { Config } from './config';

jest.setTimeout(1000 * 60 * 3);

describe('IdleDao E2E', () => {
  const dexKey = 'IdleDao';

  beforeAll(async () => {
    let results: Promise<void>[] = [];
    for (const networkEntry in Network) {
      if (isNaN(Number(networkEntry))) {
        break;
      }
      if (!Config[dexKey].hasOwnProperty(networkEntry)) {
        continue;
      }

      const network = Number(networkEntry);
      const config = Config[dexKey][network];
      const dexHelper = new DummyDexHelper(network);
      const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();

      results.push(
        fetchTokenList(
          dexHelper.web3Provider,
          blockNumber,
          config.fromBlock,
          config.factoryAddress,
          new Interface(POOL_ABI),
          new Interface(ERC20ABI),
          dexHelper.multiWrapper,
        )
          .then(tokenList => {
            setTokensOnNetwork(network, tokenList);
          })
          .catch(e => {
            console.log(`ERROR on ${Network[network]}`, e);
          }),
      );
    }
    await Promise.all(results);
  });

  /*
  describe('IdleDao ZKEVM', () => {
    const network = Network.ZKEVM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const pairs = [
      {
        tokenSymbol: 'USDT',
        aTokenSymbol: 'aPolUSDT',
        amount: '1000000',
      },
      {
        tokenSymbol: 'MATIC',
        aTokenSymbol: 'aPolWMATIC',
        amount: '1000000000000000000',
      },
      {
        tokenSymbol: 'WMATIC',
        aTokenSymbol: 'aPolWMATIC',
        amount: '1000000000000000000',
      },
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    pairs.forEach(pair => {
      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(pair.aTokenSymbol + ' -> ' + pair.tokenSymbol, async () => {
              await testE2E(
                getTokenFromIdleSymbol(network, pair.aTokenSymbol)!,
                tokens[pair.tokenSymbol],
                holders[pair.aTokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });

            it(pair.tokenSymbol + ' -> ' + pair.aTokenSymbol, async () => {
              await testE2E(
                tokens[pair.tokenSymbol],
                getTokenFromIdleSymbol(network, pair.aTokenSymbol)!,
                holders[pair.tokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        }),
      );
    });
  });

  describe('IdleDao OPTIMISM', () => {
    const network = Network.OPTIMISM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const pairs = [
      {
        tokenSymbol: 'USDC',
        aTokenSymbol: 'aOptUSDC',
        amount: '1000000',
      },
      {
        tokenSymbol: 'ETH',
        aTokenSymbol: 'aOptWETH',
        amount: '1000000000000000000',
      },
      {
        tokenSymbol: 'WETH',
        aTokenSymbol: 'aOptWETH',
        amount: '1000000000000000000',
      },
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    pairs.forEach(pair => {
      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(pair.aTokenSymbol + ' -> ' + pair.tokenSymbol, async () => {
              await testE2E(
                getTokenFromIdleSymbol(network, pair.aTokenSymbol)!,
                tokens[pair.tokenSymbol],
                holders[pair.aTokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });

            it(pair.tokenSymbol + ' -> ' + pair.aTokenSymbol, async () => {
              await testE2E(
                tokens[pair.tokenSymbol],
                getTokenFromIdleSymbol(network, pair.aTokenSymbol)!,
                holders[pair.tokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        }),
      );
    });
  });
  */

  describe('IdleDao MAINNET', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const pairs = [
      {
        tokenSymbol: 'wstETH',
        idleTokenSymbol: 'AA_wstETH',
        amount: '1000000000000000000',
      },
      {
        tokenSymbol: 'USDC',
        idleTokenSymbol: 'AA_idle_cpPOR-USDC',
        amount: '1000000',
      },
      {
        tokenSymbol: 'DAI',
        idleTokenSymbol: 'BB_idle_cpPOR-USDC',
        amount: '1000000000000000000',
      },
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
      [SwapSide.BUY, [ContractMethod.simpleBuy]],
    ]);

    pairs.forEach(pair => {
      sideToContractMethods.forEach((contractMethods, side) =>
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(pair.idleTokenSymbol + ' -> ' + pair.tokenSymbol, async () => {
              await testE2E(
                getTokenFromIdleSymbol(network, pair.idleTokenSymbol)!,
                tokens[pair.tokenSymbol],
                holders[pair.idleTokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });

            it(pair.tokenSymbol + ' -> ' + pair.idleTokenSymbol, async () => {
              await testE2E(
                tokens[pair.tokenSymbol],
                getTokenFromIdleSymbol(network, pair.idleTokenSymbol)!,
                holders[pair.tokenSymbol],
                pair.amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        }),
      );
    });
  });
});
