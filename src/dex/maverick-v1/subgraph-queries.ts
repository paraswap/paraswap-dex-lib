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
