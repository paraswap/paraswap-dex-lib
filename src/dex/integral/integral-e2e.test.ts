import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

jest.setTimeout(1000 * 60 * 3);

const testCases = [
  {
    network: Network.MAINNET,
    side: SwapSide.SELL,
    method: ContractMethod.swapExactAmountIn,
    tokenASymbol: 'USDC',
    tokenBSymbol: 'USDT',
    tokenAAmount: '5100000000',
    tokenBAmount: '5100000000',
  },
  {
    network: Network.MAINNET,
    side: SwapSide.BUY,
    method: ContractMethod.swapExactAmountOut,
    tokenASymbol: 'USDC',
    tokenBSymbol: 'USDT',
    tokenAAmount: '5100000000',
    tokenBAmount: '5100000000',
  },
  {
    network: Network.ARBITRUM,
    side: SwapSide.SELL,
    method: ContractMethod.swapExactAmountIn,
    tokenASymbol: 'WETH',
    tokenBSymbol: 'USDT',
    tokenAAmount: '1000000000000000000',
    tokenBAmount: '5100000000',
  },
  {
    network: Network.ARBITRUM,
    side: SwapSide.BUY,
    method: ContractMethod.swapExactAmountOut,
    tokenASymbol: 'WETH',
    tokenBSymbol: 'USDT',
    tokenAAmount: '1000000000000000000',
    tokenBAmount: '5100000000',
  },
];

describe('Integral E2E', () => {
  const dexKey = 'Integral';

  testCases.forEach(
    ({
      network,
      side,
      method,
      tokenASymbol,
      tokenBSymbol,
      tokenAAmount,
      tokenBAmount,
    }) => {
      it(`${network}: ${tokenASymbol} -> ${tokenBSymbol} (${side} ${method})`, async () => {
        const provider = new StaticJsonRpcProvider(
          generateConfig(network).privateHttpProvider,
          network,
        );
        const tokens = Tokens[network];
        const holders = Holders[network];

        await testE2E(
          tokens[tokenASymbol],
          tokens[tokenBSymbol],
          holders[tokenASymbol],
          side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
          side,
          dexKey,
          method,
          network,
          provider,
        );
      });
    },
  );
});
