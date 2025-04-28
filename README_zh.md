# ParaSwap DexLib [![CI](https://github.com/paraswap/paraswap-dex-lib/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/paraswap/paraswap-dex-lib/actions/workflows/ci.yaml)

**DexLib** 是 ParaSwap 后端用于集成去中心化交易所（DEX）的库。该库允许外部 DEX 开发者通过向此存储库创建拉取请求（Pull Request）来将其 DEX 集成到 ParaSwap。

## 如何将您的 DEX 添加到 ParaSwap

1.  将 [paraswap-dex-lib](https://github.com/paraswap/paraswap-dex-lib) 复刻（Fork）到您的组织或个人账户。
2.  在本地克隆（Clone）存储库，并创建一个具有适当名称的分支（例如：`feature/super-dex`）。
3.  使用以下命令安装存储库依赖项：

    ```bash
    yarn install
    ```

4.  初始化 DEX 集成。DEX 名称应采用 `param-case` 格式（短横线连接）：

    ```bash
    yarn init-integration <your-dex-name>
    ```

    您可以在 `src/dex/<your-dex-name>` 中找到新集成 DEX 的模板代码。

5.  通过填写函数实现来完成模板代码。模板代码有详细的文档，应能帮助您构建实现。您应该查看 `src/dex/` 中现有的 DEX 实现以理解接口。请参阅下文以获取详细说明和最佳实践。

6.  在 `src/dex/index.ts` 文件中的 `Dexes` 列表中添加 `<your-dex-name>`。

7.  完成测试模板（所有 `src/dex/<your-dex-name>/*.test.ts` 文件）。每个 DEX 实现都应进行彻底的测试。我们有多种类型的测试，每个 DEX 都必须包含。您可以参考 [编写测试](#writing-testing) 获取详细说明。您可以使用以下命令运行所有测试：

    ```bash
    yarn test-integration <your-dex-name>
    ```

8.  从您的功能分支向 DexLib 的 master 分支创建一个 PR（拉取请求）。PR 必须包含关于 DEX 背景、定价逻辑、现有文档链接、重要合约地址以及任何您认为有助于我们更快审查您代码的简要说明。

## DEX 集成演练（5 个步骤）

ParaSwap 通过创新的基于事件的方法优化价格服务，通过利用智能合约事件和内存状态进行定价，绕过了频繁调用全节点 RPC 的需求。
这种方法经过抽象以便于实现，要求 DEX 首先获取链上状态，通过事件订阅更新，并使用更新后的内存状态进行高效定价。

此外，ParaSwap 的主路由器（称为 Augustus）经过巧妙设计，仅需规范（链下）提示即可在不同 DEX 之间导航交换。这种设计使得可以无缝执行涉及多个 DEX 和多层代币交换的复杂交易策略。这种设计也意味着在大多数情况下，可以在不更改任何合约的情况下添加任何流动性来源。

### 步骤 1/5：初始化您的 DEX 池状态

通常，集成的第一步是初始化其池的状态。

这可以通过以下两种方式完成：

- **贪婪模式**：在启动后端服务时初始化，通过覆盖 DEX 中的 `initializePricing` 函数。
  或
- **懒惰模式**：在收到涉及您的 DEX 可以处理的资产的第一个价格请求时初始化，作为 `getPricesVolume` 函数的一部分。

后者是首选选项。

```ts
async initializePricing(blockNumber: number) {
    // 获取链上状态
    const poolState = await getOnChainState(
      this.dexHelper.multiContract, // 多重调用合约实例
      this.swETHAddress,            // 池子地址
      this.swETHInterface,         // 池子接口 (ABI)
      blockNumber                   // 区块号
    );

    // 使用获取的状态初始化事件池
    await this.eventPool.initialize(blockNumber, {
      state: poolState,
    });
}
```

上面的示例展示了如何获取 [`swETH`](https://etherscan.io/address/0xdda46bf18eeb3e06e2f12975a3a184e40581a72f#code) 合约的当前状态，在本例中是 `swETHToEthRate`（swETH 到 ETH 的汇率）。`getOnChainState` 调用正在执行一个 Multicall 合约调用，目标是 `swETHAddress`（使用 swETH ABI）。

```ts
export async function getOnChainState(
  multiContract: Contract, // 多重调用合约实例
  poolAddress: string, // 池子地址
  poolInterface: Interface, // 池子接口 (ABI)
  blockNumber: number | 'latest', // 区块号或 'latest'
): Promise<SWETHPoolState> {
  // 返回包含状态的 Promise
  // 构建聚合调用
  const data: { returnData: any[] } = await multiContract.methods
    .aggregate([
      {
        target: poolAddress, // 目标合约
        callData: poolInterface.encodeFunctionData('swETHToETHRate', []), // 编码函数调用数据
      },
    ])
    .call({}, blockNumber); // 执行调用

  // 解码返回的数据
  const decodedData = coder.decode(['uint256'], data.returnData[0]);

  // 将解码后的汇率转换为 BigInt
  const swETHToETHRateFixed = BigInt(decodedData[0].toString());

  // 返回状态对象
  return {
    swETHToETHRateFixed,
  };
}
```

在任何区块链上与智能合约交互时，您应尽量注意 RPC 调用的成本，因此，最佳方法是使用 Multicall。您可以通过 DEX 中的 `this.dexHelper.multiContract` 访问 Multicall 合约。

### 步骤 2/5：保持您的 DEX 池状态同步

`initializePricing` 调用将负责设置池的初始状态（在 DEX 初始化时）。为了确保定价正确，您可以利用 Stateful Event Subscriber（有状态事件订阅器）。

沿用前面的示例，我们现在可以实现一个监听器来监听 `Reprice` 事件，该事件由 `swETH` 池在 `swETH -> ETH` 汇率（也就是我们的 DEX 需要知道的信息）发生变化时发出。为此，我们可以覆盖 DEX 声明的 `StatefulEventSubscriber` 中的 `processLog` 方法。当订阅器正在监听的事件被发出时，将调用此方法。只有在函数返回一个状态时，状态才会在函数调用后被修改。返回 `null` 将被忽略，状态不会改变。如果您需要进行 RPC 调用，可以实现 `StatefulRpcPoller`，但使用此方法可能会导致不必要的费用，因为 RPC 调用成本要高得多。

```ts
// 解码器，用于解析日志
decoder = (log: Log) => this.poolInterface.parseLog(log);

// 处理日志的方法
protected processLog(
    state: DeepReadonly<SWETHPoolState>, // 当前只读状态
    log: Readonly<Log>,                  // 收到的只读日志
  ): AsyncOrSync<DeepReadonly<SWETHPoolState> | null> { // 返回更新后的状态或 null
    // 解码日志获取事件信息
    const event = this.decoder(log);
    // 如果事件是 'Reprice'
    if (event.name === 'Reprice')
      // 返回包含新汇率的新状态对象
      return {
        swETHToETHRateFixed: BigInt(event.args.newSwETHToETHRate),
      };

    // 如果不是关心的事件，返回 null，不改变状态
    return null;
}
```

在实现您自己的 DEX 池监听器时，其他一些可能有用的 DEX 池示例：

1.  [Uniswap V3](https://github.com/paraswap/paraswap-dex-lib/blob/master/src/dex/uniswap-v3/uniswap-v3-pool.ts#L139)
2.  [Nerve](https://github.com/paraswap/paraswap-dex-lib/blob/master/src/dex/nerve/nerve-pool.ts#L109)
3.  [Curve V1 (复杂)](https://github.com/paraswap/paraswap-dex-lib/blob/master/src/dex/curve-v1/pools/curve-pool.ts#L81) - 包含多个池子（例如 3pool、EURSPool 等）。

### 步骤 3/5：计算您的 DEX 对特定代币对和金额范围的汇率

既然我们可以保证池子的状态是最新的，我们需要确保在构造交易时始终提供正确的定价和汇率。

要做到这一点，最好的方法是复制合约的行为和计算。任何在数值操作（数学运算、位移等）上的错误都可能导致错误的价格，并引发各种情况，例如：

- 如果价格差异为正，可能导致 Paraswap 获取超额利润，并且 Gas 费用高于模拟/预期。
- 如果价格差异为负，可能导致交易失败或回滚。

查看 [swETH 合约](https://etherscan.io/address/0x2d3b4bb82bdf0a3593bcf098b5c5b6f7570211a7#code)，我们可以检查它如何为 `deposit` 函数计算输出值，并在我们的 DEX 上实现对应逻辑以确保定价正确。

```solidity
// Solidity 代码：计算存款获得的 swETH 数量
uint256 swETHAmount = wrap(msg.value).mul(_ethToSwETHRate()).unwrap();
```

这行代码获取 `deposit` 函数的 ETH 值 (`msg.value`)，并将其乘以当前的 `ethToSwETHRate`。由于池子记录的是相反的汇率 (`swETH -> ETH`)，我们需要反转这个逻辑。

```ts
// TypeScript 代码：根据 ETH 金额计算 swETH 价格
getPrice(blockNumber: number, ethAmount: bigint): bigint {
    // 获取指定区块的状态
    const state = this.getState(blockNumber);
    // 如果没有状态，抛出错误
    if (!state) throw new Error('Cannot compute price');
    // 从状态中解构出 swETH 到 ETH 的固定汇率
    const { swETHToETHRateFixed } = state;

    // 计算 swETH 金额： (ethAmount * 10^18) / swETHToETHRateFixed
    return (ethAmount * BI_POWS[18]) / swETHToETHRateFixed;
  }
```

### 步骤 4/5：允许 Augustus 通过您的 DEX 进行交换

当用户想要交换时，我们需要计算 Augustus 的 calldata，这涉及到计算通过您的 DEX 进行交换所需的数据。
具体来说，您需要对通过您的 DEX 进行给定占位符金额的交换进行 ABI 编码，并提供有关您的 DEX 的额外元数据，以便执行复杂的交换。

例如，让我们看一下 `swell` DEX 集成和 `getDexParam` 实现，看看这种编码是如何实现的。请注意，以下示例为简洁起见进行了简化。

```ts
getDexParam(
    srcToken: Address,    // 源代币地址
    destToken: Address,   // 目标代币地址
    srcAmount: NumberAsString, // 源代币金额 (字符串)
    destAmount: NumberAsString, // 目标代币金额 (字符串)
    recipient: Address,  // 接收者地址
    data: SwellData,      // 特定于 Swell 的数据
    side: SwapSide,       // 交换方向 (买入/卖出)
  ): DexExchangeParam { // 返回 DEX 交换参数
    // 编码 Swell 合约的 deposit 函数调用
    const swapData = this.swETHInterface.encodeFunctionData(
      swETHFunctions.deposit,
      [],
    );

    // 返回 DEX 交换参数对象
    return {
      needWrapNative: this.needWrapNative, // 是否需要包装原生代币
      dexFuncHasRecipient: false,           // DEX 函数是否有接收者参数
      exchangeData: swapData,             // 编码后的交换数据
      targetExchange: this.swETHAddress,  // 目标交换合约地址
      returnAmountPos: undefined,         // 返回金额在返回数据中的位置 (可选)
    };
 }
```

<details>
<summary>一个更高级的 getDexParam 示例。</summary>

```ts
    getDexParam(
        srcToken: Address,    // 源代币地址
        destToken: Address,   // 目标代币地址
        srcAmount: NumberAsString, // 源代币金额 (字符串)
        destAmount: NumberAsString, // 目标代币金额 (字符串)
        recipient: Address,  // 接收者地址
        data: WooFiV2Data,      // 特定于 WooFi V2 的数据
        side: SwapSide,       // 交换方向 (买入/卖出)
      ): DexExchangeParam { // 返回 DEX 交换参数
        // 如果是买入操作，抛出错误，因为不支持
        if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

        // ...（省略了 WooFi V2 的具体实现细节）...
      }
```

</details>

### 步骤 5/5：编写测试！

编写测试是确保您的 DEX 集成不仅现在有效，而且将来也能保持有效的关键。

#### 集成测试

集成测试（文件扩展名为 `.integration.test.ts`）会调用您的 DEX 实现的 `getPricesVolume` 函数，并检查返回的价格是否合理。它还检查价格数组的排序是否正确、价格之间是否存在较大差距等。

```ts
// 定义测试用例
it('WETH -> USDC', async () => {
  // 设置源代币、目标代币和金额
  const srcToken = WETH[Network.MAINNET];
  const destToken = USDC[Network.MAINNET];
  const amounts = [1e18, 10e18, 100e18];

  // 获取价格
  const prices = await curveV1.getPricesVolume(
    srcToken,
    destToken,
    amounts.map(String), // 将金额转换为字符串
    SwapSide.SELL, // 交换方向为卖出
    Network.MAINNET,
  );

  // 检查池子价格
  checkPoolPrices(prices!, amounts, SwapSide.SELL, dexKey);
});
```

#### Gas 估算测试

Gas 估算测试（文件扩展名为 `.gas-estimation.test.ts`）旨在确保通过您的 DEX 进行交换的 Gas 成本估算在合理范围内。

```ts
// 定义测试套件
describe('CurveV1 Gas Estimation Tests', () => {
  // 定义网络和 DEX 密钥
  const network = Network.MAINNET;
  const dexKey = DexKey.CURVE_V1;

  // 测试不同的方法
  methods.forEach(async method => {
    // 描述当前测试的方法
    describe(method, () => {
      // 定义测试用例：一次交换
      it('one swap', async () => {
        // 进行 Gas 估算测试
        await testGasEstimation(
          network, // 网络
          WETH[network], // 源代币
          DAI[network], // 目标代币
          amount, // 金额
          SwapSide.SELL, // 交换方向
          dexKey, // DEX 密钥
          method, // 测试方法
        );
      });
    });
  });
});
```

#### 构建交易测试

构建交易测试（文件扩展名为 `.build-tx.test.ts`）是可选的，但强烈建议进行。它确保您的 DEX 实现能够正确构建在 Tenderly 上可执行的交易。如果此测试失败，很可能用户也无法通过 ParaSwap 执行涉及您 DEX 的交易。

```ts
// 定义测试套件
describe('CurveV1 Build Tx Tests', () => {
  // 定义网络和 DEX 密钥
  const network = Network.MAINNET;
  const dexKey = DexKey.CURVE_V1;

  // 测试不同的方法
  methods.forEach(async method => {
    // 描述当前测试的方法
    describe(method, () => {
      // 定义测试用例：一次交换
      it('one swap', async () => {
        // 进行交易构建测试
        await testBuildTx(
          network, // 网络
          WETH[network], // 源代币
          DAI[network], // 目标代币
          amount, // 金额
          SwapSide.SELL, // 交换方向
          dexKey, // DEX 密钥
          method, // 测试方法
        );
      });
    });
  });
});
```

## 重要概念

### DexHelper

`DexHelper` 是一个抽象类，提供对 ParaSwap 后端基础设施的访问。您应该将 DexHelper 的实例传递给您的 DEX 实现的构造函数。这允许您访问：

- `this.dexHelper.multiContract`: 一个 Multicall 合约实例，用于批量 RPC 调用。
- `this.dexHelper.getTokenUSDPrice`: 一个函数，用于获取给定代币和金额的美元价格。
- `this.dexHelper.logger`: 一个日志记录器实例。

### EventPool

`EventPool` 是一个围绕有状态事件订阅器（`StatefulEventSubscriber`）的包装器，它抽象化了事件处理和状态管理的复杂性。它负责：

- 初始化状态。
- 订阅事件。
- 处理日志并相应地更新状态。
- 在需要时提供特定区块的状态。

### PoolLiquidity

`PoolLiquidity` 接口用于 `getTopPoolsForToken` 函数。此函数的目标是发现给定代币流动性最强的池子。这对于构建给定代币对的路由至关重要。返回的数据应包括池子地址、涉及的代币以及池子中美元计价的总流动性。

```ts
interface PoolLiquidity {
  poolAddress: Address; // 池子地址
  token0: Address; // 代币 0 地址
  token1: Address; // 代币 1 地址
  totalLiquidityUSD: NumberAsString; // 美元计价的总流动性 (字符串)
}
```

要实现这一点，通常的方法是查询 DEX 的 subgraph（如果可用）或直接查询链上数据以获取流动性信息。

```ts
    // 获取给定代币地址的顶部池子
    async getTopPoolsForToken(
        tokenAddress: Address, // 代币地址
        limit: number,        // 限制数量
      ): Promise<PoolLiquidity[]> { // 返回 PoolLiquidity 数组的 Promise
        // 如果没有 subgraph URL，记录错误并返回空数组
        if (!this.subgraphURL) {
          this.logger.error('Subgraph URL not set');
          return [];
        }

        // 构建 GraphQL 查询
        const query = `
            query ($token: Bytes!, $count: Int) {
              // 查询 token0 匹配的池子
              pools0: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token0: $token, reserve0_gt: 1, reserve1_gt: 1}) {
                id
                token0 { id }
                token1 { id }
                reserveUSD
              }
              // 查询 token1 匹配的池子
              pools1: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token1: $token, reserve0_gt: 1, reserve1_gt: 1}) {
                id
                token0 { id }
                token1 { id }
                reserveUSD
              }
            }
          `;

        // 定义查询变量
        const variables = { token: tokenAddress.toLowerCase(), count: limit };
        // 通过 dexHelper 发送 subgraph 请求
        const data = await this.dexHelper.makeSubgraphRequest<{
          pools0: SubgraphPair[];
          pools1: SubgraphPair[];
        }>(this.subgraphURL, query, variables, {
          timeout: SUBGRAPH_TIMEOUT, // 设置超时
          type: this.subgraphType, // 设置 subgraph 类型
        });

        // 合并并映射结果为 PoolLiquidity 格式
        return [...data.pools0, ...data.pools1].map(pool => ({
          poolAddress: pool.id,
          token0: pool.token0.id,
          token1: pool.token1.id,
          totalLiquidityUSD: pool.reserveUSD,
        }));
      }
```
