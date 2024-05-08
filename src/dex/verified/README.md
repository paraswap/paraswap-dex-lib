## Verified Network Setup

The Verified Network contains 2 major files:
verified-pool.ts: contains utilities methods for paraswap integration

verified.ts: contains core mehods for paraswap integration

## Verified-pools.ts Methods

1. fetchAllSubgraphPools: query verified subgraph for primary or secondary issue pool and save to memory(if memory pools cache exist in memory it uses that instead). It takes no parameter as argument
2. getOnChainState: Makes onchain multicalls using precontructed data. Decodes the results and returns saved pools in address to poolstate Mapping. It takes parameters:
   subgraphPoolBase: array of pool fetched from subgraph
   blockNumber: block number to make all onchain related calls from
3. generateState: generates state using on-chain calls. This function is called to regenerate state if the event based system fails to fetch events and the local/memory state is no more correct. It takes parameter
   blockNumber: block number to generate state from
4. getPricesPool: gets prices for token from/to in a pool(primary or secondary issue pool) when buying or selling. note: amount must be an array of bigIntegers with 0 as first element: [0n, amount].
   It takes parameters:
   from: Token Object({
   address: "token address"
   decimals: "number of decimals"
   }) to swap from or token in,
   to: Token Object({
   address: "token address"
   decimals: "number of decimals"
   }) to swap to or token out,
   subgraphPool: pool to swap from,
   poolState: pool state of pool to swap from,
   amounts: array of bigIntegers. must start with 0n [0n, amounts],
   unitVolume: bigInteger of unitVolume i.e 1 \* 10 \*\* tokenDecimals ,
   side: swap side "Buy" or "Sell",
   creator: sender's address can be empty string '',
5. handleSwap: this is an handler that handles changes in pool after a swap. It takes parameters:
   event: type of eventt that caused the changes,
   pool: pool to assert changes,
   log: logger to log any channges. can be null
6. handlePoolBalanceChanged: this is an handler that handles changes in pool balances. It takes parameters:
   event: type of eventt that caused the changes,
   pool: pool to assert changes,
   log: logger to log any channges. can be null

## Verified.ts Methods

1. getPoolsWithTokenPair: gets first 10 pools with token from and token to as their maintokens.
   It takes parameters:
   from: Token Object({
   address: "token address"
   decimals: "number of decimals"
   }) of token from or token in,
   to: Token Object({
   address: "token address"
   decimals: "number of decimals"
   }) token to or token out
2. getPoolIdentifiers: Returns list of pool identifiers that can be used for a given swap. it uses the format "Verified\_{poolAddress}". It takes parameters:
   srcToken: Token Object({
   address: "token address"
   decimals: "number of decimals"
   }) of token from or token in
   destToken: Token Object({
   address: "token address"
   decimals: "number of decimals"
   }) token to or token out
   side: swap type Buy or Sell. can be null ,
   blockNumber: block nuber. can be null,
3. getPricesVolume: Returns pool prices for amounts.
   note:
   amount must be an array with 0 as first element: [0n, amounts].
   If limitPools is defined only pools in limitPools will be used
   It will call the getPoolPrices from verified-pool.ts
   It takes parameter:
   srcToken: Token Object({
   address: "token address"
   decimals: "number of decimals"
   }) of token from or token in,
   destToken: Token Object({
   address: "token address"
   decimals: "number of decimals"
   }) token to or token out,
   amounts: array of bigIntegers. must start with 0n, [0n, amounts],
   side: SwapSide Buy or Sell,
   blockNumber: block number,
   limitPools?: list of limit pool address to use. can be null,
4. getCalldataGasCost: Returns estimated gas cost of calldata for this DEX in multiSwap. It does nott take any parameters for now.
5. getVerifiedParam: construct parameters needed for swap on verified pools. It takes arguent format them and return batchSwap parammeters that can be sent to balancer vault contract to perform onchain swap.
   It takes parameters:
   srcToken: symbol of token in or token from,
   destToken: symbol of token out or token to,
   srcAmount: amount of token in/from in string. can be null(since data contains amount too),
   destAmount: amount of token out/to in string. must be null(since verified doesn't take amount out),
   data: data object of swap, it conttains poolid, amount or limitOrder and price. limitOrder and price can be null for markett orders,
   side: tttype of swap. Buy or Sell,
6. preProcessTransaction: checks if vault has been preapproved to have access to amount of from token
7. getAdapterParam: Encode params required by the exchange adapter, used for multiSwap, buy & megaSwap.
   It takes parameters:
   srcToken: symbol of token in or token from,
   destToken: symbol of token out or token to,
   srcAmount: amount of token in/from in string. can be null(since data contains amount too),
   destAmount: amount of token out/to in string. must be null(since verified doesn't take amount out),
   data: data object of swap, it conttains poolid, amount or limitOrder and price. limitOrder and price can be null for markett orders,
   side: type of swap. Buy or Sell
8. getDirectParam: constructs parameters for direct Buy or Direct Sell on balancer vault.
   It takes parameters:
   srcToken: address of token in,
   destToken: address of ttoken out,
   srcAmount: amount of token in as string,
   destAmount: amount of token out as string,
   expectedAmount: NumberAsString,
   data: swap data,
   side: swap type Buy or Sell,
   permit: string,
   uuid: unique id to use,
   feePercent: swap fee as sttring,
   deadline: deadline number as string. can be null since swap param has it's own deadline,
   partner: string,
   beneficiary: receiver's wallet address,
   contractMethod?: directBalancerV2GivenInSwap' or 'directBalancerV2GivenOutSwap'
9. getSimpleParam: // Encode call data used by simpleSwap like routers. Used for simpleSwap & simpleBuy by calling battchSwap on balancer's vault. It takes parameters:
   srcToken: symbol of token in or token from,
   destToken: symbol of token out or token to,
   srcAmount: amount of token in/from in string. can be null(since data contains amount too),
   destAmount: amount of token out/to in string. must be null(since verified doesn't take amount out),
   data: data object of swap, it conttains poolid, amount or limitOrder and price. limitOrder and price can be null for markett orders,
   side: tttype of swap. Buy or Sell
10. updatePoolState: This is called once before getTopPoolsForToken is called for multiple tokens. This can be helpful to update common state required for calculating getTopPoolsForToken by fetching subgraph pools first. It takes no parameters
11. getTopPoolsForToken: Returns list of top pools that allow swap for a particular token address. note: count passed is the maximum number of pools it will return. It takes parameters:
    tokenAddress: address of token to get top pools for,
    count: maximum number of pools to return.

## Verified Tests

1.  verified-events.test.ts: Verified supports 2 events for it pools. "Swap" and "PoolBalanceChanged" eventts hence why there are 2 handlers: handleSwap and handlePoolBalanceChanged respectively in verified-pool.ts file. Tests under this file ensure that the Swap event is working as intended for both primary and secondary issue pools. Itt will fettch all subgraph pools, make onchain calls for all fetched pools and save their states then ensure the Swap event is handled. It tests mainly Swap event and verified-pool.ts methods

2.  verified-integration.test.ts: This test how paraswap inttegrattion will work witth verified by calling major methods from verified.ts file for both primary and secondary pools.
    It tests price by comparing offchain price to onchain price usingg these steps:

    1.  call getPricesVolume which will calculate amount out or in on primary or secondary pool using their respective calculations.
    2.  call "queryBatchSwap" on balancer vault to get amount out or in primary or secondary pool.
    3.  For primary pool: compare the offchain amounttt out or in from step 1 to onchain amount out or in from step 2..
    4.  For Secondary pool: don't compare offchain amount from step 1 to onchain amount from step2 because offchain amount return amount out or in for security/currency while onchain amount returns vpt amount out which are nottt the same. note: vpt amount out from step 2 needs tto be used to claim/settle trade for security/currency on verified network before the amount out or amount in can match with amount from sttep 1.
        It tests getTopPoolsForToken for both primary and secondary securitty/currenncy token.
        It tests for liquidity ttto ensure tottalliquidity of top pools are more than 0.
        It also test getPoolIdentifiers, getVerifiedParam for queryBatchswap and battchSwap and more.

3.  verified-e2e.test.ts: This test different ttype of onchain tests for simpleSwap, directSwap, megaSwap e.t.c. It uses ttenderly to send transactions emulating real blockchain. This test is incomplete for now since paraswap needs to approve and add verified adapter for e2e tests to run.

## How to run verified tests

1. clone the verified-paraswap repo using command:
   `git clone https://github.com/verified-network/verified-paraswap.git`
   or clone any branch incase master branch is nott up to date:
   `git clone -b {branch-name} https://github.com/verified-network/verified-paraswap.git`

2. Install dependencies: under the base directory 'verified-paraswap' run command:
   `yarn install`

3. Add .env file: Verified tests run on polygon(137) chain and it requires an ethers provider to run. Create an infura account and add api key, infura url will be used to initialize the provider.
   From the base directory 'verified-paraswap' create a new file with name '.env'.
   In the env file add the parameter:
   `HTTP_PROVIDER_137= https://polygon-mainnet.infura.io/v3/{infura-api-key}`
   note:
   polygon(137) mustt be supported for the infura api key used above
   other parameters like:
   TENDERLY_TOKEN
   TENDERLY_ACCOUNT_ID
   TENDERLY_PROJECT
   TENDERLY_FORK_ID
   TENDERLY_FORK_LAST_TX_ID
   may be needed on .env file for verified e2e tests run.

4. Run tests: To runn verified tests, from the base directory 'verified-paraswap' run command:
   `yarn test-integration verified`
   This will run all the test using jest showing how many test ran succesfully and how many failed.

## At least 10 tests must passed in total for verified-event and verified-integration tests. veried-e2e may fail depending on if paraswap has approved and added verified adapter to run.
