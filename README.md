# ParaSwap DexLib

**DexLib** is a library used by ParaSwap backend to integrate with decentralized exchanges. This library enables external DEX developers to integrate their DEX with ParaSwap by creating pull requests to this repository.

### Steps to add new exchange to DexLib

1. Fork [paraswap-dex-lib](https://github.com/paraswap/paraswap-dex-lib) to your organization or personal account.
2. Clone the repository locally and create an branch with appropriate name (eg: `feature/super-dex`)
3. Install the repository dependencies using:

```bash
yarn install
```

4. Initialize the DEX integration. The DEX name should be in `param-case`:

```bash
yarn init-integration <your-dex-name>
```

You can find template code for newly integrated Dex in `src/dex/<your-dex-name>` 5. Complete the template code by filling the functions implementations. Template code is highly documented which should help you build the implementation. You should look into existing DEX implementation in `src/dex/` to understand the interfaces. Please refer below for detailed explainations and good practices. 6. Complete the test templates (All files with `src/dex/<your-dex-name>/*.test.ts`). Each DEX implementation should have thorough testing. We have multiple kinds of tests each dex must have. You can refer to [Writing Tests](#writing-testing) for detailed explaination. You can run all the tests using

```bash
yarn test-integration <your-dex-name>
```

7. Create a PR(pull-request) from your feature branch to DexLib master. The PR must contain brief explanation about the DEX background, pricing logic, links to existing documentation, important contract addresses, and anything you think could help us review your code faster.

### Understanding the event based pricing approach

One of the most important features of ParaSwap is to serve prices efficiently and quickly. As the number of requests grow, and blockchain get faster, it's not feasible to perform fullnode rpc calls to hundreds of pools for every pricing request. To solve this issue ParaSwap uses a novel event based pricing approach which allows to create pricing without performing the fullnode calls everytime. `Event` are triggers released by the smart contract when certain changes happen. External services can easily subscribe to these events by websocket connection to a fullnode rpc.

To follow ParaSwap's event based approach DEX should fetch the required on chain state to do pricing once, subscribe to events, update state when events are released, and on price request only use in memory state to create prices.To make the whole event based approach easy to implement and optimized on backend, most of the implementation logic is abstracted and developers have to only obey a simple interface.

TODO: explain the blockmanager and stateful event subscriber

### Good Practices for DEX integration

- Fullnode calls are expensive. An integration should minimize the number of fullnode rpc calls by following [Event based Pricing](#Understanding-the-event-based-pricing-approach)
- Use Multicall. Instead of performing each RPC calls individually they should be batched together into one multicall.
- Contract & Interface instances should be reused. There will be cases when you would be lured to create Contract/Interface objects for every dex pool to perform on-chain calls. This can lead to memory leaks in DEXes like UniswapV2 where there can be arbitrarily many pools. In such cases all the pools with the same abi should reuse the same Contract/Interface object.

### Writing Testing

- Integration Tests (`<you-dex-name>-integration.test.ts`): Tests the basic validity of the integration like prices are valid, obeys the limit pools, etc.
- Events Unit Tests (`<you-dex-name>-events.test.ts`): Unit tests the event based system. This is done by fetching the state on-chain before the event, manually pushing the block logs to the event subsriber, comparing the local state with on-chain state.
- E2E Tests (`<you-dex-name>-e2e.test.ts`): End to end test the intergation which involves pricing, transaction building and simulating the transaction on chain using tenderly fork simulations.
