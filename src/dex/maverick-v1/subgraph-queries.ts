export const fetchAllPools = `
  query($count: Int){
      pools(first: $count, orderDirection: desc) {
          id
          tickSpacing
          fee
          lookback
          protocolFeeRatio
          tokenA {
              id
              decimals
              symbol
          }
          tokenB {
              id
              decimals
              symbol
          }
      }
  }
`;

export const fetchPoolsSortedByBalanceUsd = `
query ($token: Bytes!, $count: Int) {
  pools0: pools(
    first: $count
    orderBy: balanceUSD
    orderDirection: desc
    where: { tokenA: $token }
  ) {
    id
    tokenA {
      id
      decimals
    }
    tokenB {
      id
      decimals
    }
    balanceUSD
  }
  pools1: pools(
    first: $count
    orderBy: balanceUSD
    orderDirection: desc
    where: { tokenB: $token }
  ) {
    id
    tokenA {
      id
      decimals
    }
    tokenB {
      id
      decimals
    }
    balanceUSD
  }
}
`;
