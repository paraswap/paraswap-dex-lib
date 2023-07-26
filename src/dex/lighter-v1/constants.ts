export const stablecoins = ['USDC', 'USDT', 'USDC.e', 'DAI'];

export function replaceTokenSymbol(tokenSymbol: string) {
  if (tokenSymbol === 'WETH') return 'ETH';
  if (tokenSymbol === 'WBTC') return 'BTC';
  return tokenSymbol;
}
