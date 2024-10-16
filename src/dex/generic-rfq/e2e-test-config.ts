import { Network, SwapSide } from '../../constants';

export const testConfig: {
  [network: number]: Array<{
    srcToken: string;
    destToken: string;
    swapSide: SwapSide;
    amount: string;
  }>;
} = {
  [Network.ARBITRUM]: [
    {
      srcToken: 'WETH',
      destToken: 'USDC',
      amount: '10000',
      swapSide: SwapSide.BUY,
    },
    {
      srcToken: 'USDC',
      destToken: 'WETH',
      amount: '10000',
      swapSide: SwapSide.SELL,
    },
  ],
};
