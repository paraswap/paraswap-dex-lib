export const fetchAllPools = `
  query($count: Int){
      pools(first: $count, orderBy: balanceUSD, orderDirection: desc) {
          id
          fee
          w
          h
          k
          paramChoice
          twauLookback
          uShiftMultiplier
          maxSpreadFee
          spreadFeeMultiplier
          protocolFeeRatio
          epsilon
          quoteBalance
          baseBalance
          base {
              id
              decimals
              symbol
          }
          quote {
              id
              decimals
              symbol
          }
      }
  }
`;

export const fetchPoolsFromTokens = `
  query($count: Int, $from: [String], $to: [String]){
      pools(first: $count, orderBy: balanceUSD, orderDirection: desc, where: {quote_in: $from, base_in: $to}) {
          id
          fee
          w
          h
          k
          paramChoice
          twauLookback
          uShiftMultiplier
          maxSpreadFee
          spreadFeeMultiplier
          protocolFeeRatio
          epsilon
          quoteBalance
          baseBalance
          base {
              id
              decimals
              symbol
          }
          quote {
              id
              decimals
              symbol
          }
      }
  }
`;

export const fetchQuoteTokenPools = `
  query($count: Int, $token: [String]){
      pools(first: $count, orderBy: balanceUSD, orderDirection: desc, where: {quote_in: $token}) {
          id
          fee
          w
          h
          k
          paramChoice
          quoteBalance
          baseBalance
          balanceUSD
          base {
              id
              decimals
              symbol
          }
          quote {
              id
              decimals
              symbol
          }
      }
  }
`;

export const fetchBaseTokenPools = `
  query($count: Int, $token: [String]){
      pools(first: $count, orderBy: balanceUSD, orderDirection: desc, where: {base_in: $token}) {
          id
          fee
          w
          h
          k
          paramChoice
          quoteBalance
          baseBalance
          balanceUSD
          base {
              id
              decimals
              symbol
          }
          quote {
              id
              decimals
              symbol
          }
      }
  }
`;
