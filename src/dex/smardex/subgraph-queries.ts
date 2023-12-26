export const fetchPaginatedPairUSDReservesQuery = (
  first: number,
  skip: number,
) =>
  `query {
    pairs(
      orderBy: reserveUSD
      orderDirection: desc
      where: {reserve0_gt: 1, reserve1_gt: 1}
      first: ${first}
      skip: ${skip}
    ) {
      id
      reserveUSD
    }
  }`;
