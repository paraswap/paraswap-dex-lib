import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('Camelot E2E', () => {
  describe('Camelot', () => {
    const network = Network.ARBITRUM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const dexKey = 'Camelot';

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.swapExactAmountIn,
          // ContractMethod.simpleSwap,
          // ContractMethod.multiSwap,
          // ContractMethod.megaSwap,
        ],
      ],
    ]);

    type TestingPair = {
      name: string;
      sellAmount: string;
    };
    // To be tested against E2E endpoint
    type TestingOptions = {
      srcTokenTransferFee: number;
      destTokenTransferFee: number;
      srcTokenDexTransferFee: number;
      destTokenDexTransferFee: number;
      slippage: number;
    };
    type TestingParams =
      | [TestingPair, TestingPair, TestingOptions]
      | [TestingPair, TestingPair];

    const pairs: TestingParams[] = [
      [
        { name: 'ETH', sellAmount: '700000000000' },
        { name: 'USDC', sellAmount: '1000000' },
      ],
      [
        { name: 'ETH', sellAmount: '700000000000' },
        { name: 'USDT', sellAmount: '1000000' },
      ],
      [
        { name: 'USDC', sellAmount: '100000000' },
        { name: 'WETH', sellAmount: '200000000000' },
      ],
      [
        { name: 'USDC', sellAmount: '100000' },
        { name: 'DAI', sellAmount: '200000000000000' },
      ],
      [
        { name: 'USDC', sellAmount: '100000' },
        { name: 'USDT', sellAmount: '100000' },
      ],
      // Tax token without config
      [
        { name: 'RDPX', sellAmount: '100000000' },
        { name: 'ETH', sellAmount: '1000000000' },
        {
          srcTokenTransferFee: 0,
          destTokenTransferFee: 0,
          srcTokenDexTransferFee: 1000,
          destTokenDexTransferFee: 0,
          slippage: 1000,
        },
      ],
      [
        { name: 'RDPX', sellAmount: '100000000' },
        { name: 'WETH', sellAmount: '100000000' },
        {
          srcTokenTransferFee: 0,
          destTokenTransferFee: 0,
          srcTokenDexTransferFee: 1000,
          destTokenDexTransferFee: 0,
          slippage: 1000,
        },
      ],
      [
        { name: 'RDPX', sellAmount: '100000000' },
        { name: 'DAI', sellAmount: '100000000' },
        {
          srcTokenTransferFee: 0,
          destTokenTransferFee: 0,
          srcTokenDexTransferFee: 1000,
          destTokenDexTransferFee: 0,
          slippage: 1000,
        },
      ],
      // Tax token with config
      [
        { name: 'SEN', sellAmount: '100000000000000000' },
        { name: 'ETH', sellAmount: '100000000000000000' },
      ],
      [
        { name: 'SEN', sellAmount: '100000000000000000' },
        { name: 'WETH', sellAmount: '100000000000000000' },
      ],
    ];

    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          pairs.forEach(pair => {
            describe(`${contractMethod}`, () => {
              it(`${pair[0].name} -> ${pair[1].name}`, async () => {
                await testE2E(
                  tokens[pair[0].name],
                  tokens[pair[1].name],
                  holders[pair[0].name],
                  pair[0].sellAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                  undefined,
                  undefined,
                  (pair[2] ? pair[2] : undefined) as any,
                  (pair[2] ? pair[2].slippage : undefined) as any,
                );
              });
              it(`${pair[1].name} -> ${pair[0].name}`, async () => {
                await testE2E(
                  tokens[pair[1].name],
                  tokens[pair[0].name],
                  holders[pair[1].name],
                  pair[1].sellAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                  undefined,
                  undefined,
                  (pair[2] ? pair[2] : undefined) as any,
                  (pair[2] ? pair[2].slippage : undefined) as any,
                );
              });
            });
          });
        });
      }),
    );
  });
});
