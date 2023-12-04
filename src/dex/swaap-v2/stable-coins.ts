import { Network } from '../../constants';

// addresses must be consistant with utils.normalizeTokenAddress
export const STABLE_COINS: {
  [network: number]: { [symbol: string]: boolean };
} = {
  [Network.MAINNET]: {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': true, // USDT
    '0xdac17f958d2ee523a2206206994597c13d831ec7': true, // USDC
    '0x6b175474e89094c44da98b954eedeac495271d0f': true, // DAI
    '0x853d955acef822db058eb8505911ed77f175b99e': true, // FRAX
  },
  [Network.POLYGON]: {
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': true, // USDC
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': true, // USDC.e
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': true, // USDT
    '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063': true, // DAI
  },
  [Network.ARBITRUM]: {
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': true, // USDC
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': true, // USDC.e
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': true, // USDT
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': true, // DAI
  },
};
