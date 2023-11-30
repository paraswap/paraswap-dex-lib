import { DeepReadonly } from 'ts-essentials';
import { lens } from '../../lens';
import { Address, Logger, MultiCallInput } from '../../types';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, DexParams, PoolConfig } from './types';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { FastPriceFeed } from './fast-price-feed';
import { VaultPriceFeed } from './vault-price-feed';
import { Vault } from './vault';
import { USDG } from './usdg';
import { Contract } from 'web3-eth-contract';
import ReaderABI from '../../abi/gmx/reader.json';
import { BMX } from './bmx';

const MAX_AMOUNT_IN_CACHE_TTL = 5 * 60;

export class GMXEventPool extends ComposedEventSubscriber<PoolState> {
  PRICE_PRECISION = 10n ** 30n;
  USDG_DECIMALS = 18;
  BASIS_POINTS_DIVISOR = 10000n;
  DEGRADATION_COEFFICIENT = 10n ** 18n;

  vault: Vault<PoolState>;
  reader: Contract;
  glpManager: Address;

  constructor(
    parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    config: PoolConfig,
  ) {
    const chainlinkMap = Object.entries(config.chainlink).reduce(
      (
        acc: { [address: string]: ChainLinkSubscriber<PoolState> },
        [key, value],
      ) => {
        acc[key] = new ChainLinkSubscriber<PoolState>(
          value.proxy,
          value.aggregator,
          lens<DeepReadonly<PoolState>>().primaryPrices[key],
          dexHelper.getLogger(`${key} ChainLink for ${parentName}-${network}`),
        );
        return acc;
      },
      {},
    );
    const fastPriceFeed = new FastPriceFeed(
      config.fastPriceFeed,
      config.fastPriceEvents,
      config.tokenAddresses,
      config.fastPriceFeedConfig,
      lens<DeepReadonly<PoolState>>().secondaryPrices,
      dexHelper.getLogger(`${parentName}-${network} fastPriceFeed`),
    );
    const vaultPriceFeed = new VaultPriceFeed(
      config.vaultPriceFeedConfig,
      chainlinkMap,
      fastPriceFeed,
    );
    const wblt = new USDG(
      config.wbltAddress,
      lens<DeepReadonly<PoolState>>().wblt,
      dexHelper.getLogger(`${parentName}-${network} WBLT`),
    );
    const glp = new USDG(
      config.glpAddress,
      lens<DeepReadonly<PoolState>>().glp,
      dexHelper.getLogger(`${parentName}-${network} GLP`),
    );
    const usdg = new USDG(
      config.usdgAddress,
      lens<DeepReadonly<PoolState>>().usdg,
      dexHelper.getLogger(`${parentName}-${network} USDG`),
    );
    const vault = new Vault(
      config.vaultAddress,
      config.tokenAddresses,
      config.vaultConfig,
      vaultPriceFeed,
      usdg,
      lens<DeepReadonly<PoolState>>().vault,
      dexHelper.getLogger(`${parentName}-${network} vault`),
    );
    super(
      parentName,
      'pool',
      dexHelper.getLogger(`${parentName}-${network}`),
      dexHelper,
      [...Object.values(chainlinkMap), fastPriceFeed, wblt, glp, usdg, vault],
      {
        primaryPrices: {},
        secondaryPrices: {
          lastUpdatedAt: 0,
          prices: {},
        },
        vault: {
          usdgAmounts: {},
        },
        usdg: {
          totalSupply: 0n,
        },
        glp: {
          totalSupply: 0n,
        },
        wblt: {
          totalSupply: 0n,
        },
      },
    );
    this.vault = vault;
    this.reader = new this.dexHelper.web3Provider.eth.Contract(
      ReaderABI as any,
      config.readerAddress,
    );
    this.glpManager = config.glpManager;
  }

  async getStateOrGenerate(blockNumber: number): Promise<Readonly<PoolState>> {
    const evenState = this.getState(blockNumber);
    if (evenState) return evenState;
    const onChainState = await this.generateState(blockNumber);
    this.setState(onChainState, blockNumber);
    return onChainState;
  }

  async getMaxAmountIn(_tokenIn: Address, _tokenOut: Address): Promise<bigint> {
    const cacheKey = `maxAmountIn_${_tokenIn}_${_tokenOut}`;
    const maxAmountCached = await this.dexHelper.cache.get(
      this.parentName,
      this.network,
      cacheKey,
    );
    if (maxAmountCached) return BigInt(maxAmountCached);
    const maxAmount: string = await this.reader.methods
      .getMaxAmountIn(this.vault.vaultAddress, _tokenIn, _tokenOut)
      .call();
    this.dexHelper.cache.setex(
      this.parentName,
      this.network,
      cacheKey,
      MAX_AMOUNT_IN_CACHE_TTL,
      maxAmount,
    );
    return BigInt(maxAmount);
  }

  async getWbltFreeFundsAndAumInUsdg(
    wblt: Address,
    maximise: Boolean,
    blockNumber: number,
  ): Promise<bigint[]> {
    const cacheKey = 'bmx_auimInUsdgAndFreeFunds';
    const auimInUsdgAndFreeFunds = await this.dexHelper.cache.get(
      this.parentName,
      this.network,
      cacheKey,
    );
    if (auimInUsdgAndFreeFunds)
      return auimInUsdgAndFreeFunds.split(',').map(a => BigInt(a));

    let multicallCalldata = [];

    multicallCalldata.push({
      callData: BMX.wbltInterface.encodeFunctionData('lastReport', []),
      target: wblt,
    });

    multicallCalldata.push({
      callData: BMX.wbltInterface.encodeFunctionData(
        'lockedProfitDegradation',
        [],
      ),
      target: wblt,
    });

    multicallCalldata.push({
      callData: BMX.wbltInterface.encodeFunctionData('lockedProfit', []),
      target: wblt,
    });

    multicallCalldata.push({
      callData: BMX.wbltInterface.encodeFunctionData('totalAssets', []),
      target: wblt,
    });

    multicallCalldata.push({
      callData: BMX.glpManagerInterface.encodeFunctionData('getAumInUsdg', [
        maximise,
      ]),
      target: this.glpManager,
    });

    const results = (
      await this.dexHelper.multiContract.methods
        .aggregate(multicallCalldata)
        .call({}, blockNumber)
    ).returnData;

    let lastReport = BigInt(
      BMX.wbltInterface
        .decodeFunctionResult('lastReport', results[0])
        .toString(),
    );
    let lockedProfitDegradation = BigInt(
      BMX.wbltInterface
        .decodeFunctionResult('lockedProfitDegradation', results[1])
        .toString(),
    );
    let lockedProfit = BigInt(
      BMX.wbltInterface
        .decodeFunctionResult('lockedProfit', results[2])
        .toString(),
    );
    let totalAssets = BigInt(
      BMX.wbltInterface
        .decodeFunctionResult('totalAssets', results[3])
        .toString(),
    );
    let aumInUsdg = BigInt(
      BMX.glpManagerInterface
        .decodeFunctionResult('getAumInUsdg', results[4])
        .toString(),
    );

    let blockTimestamp = BigInt(
      (await this.dexHelper.web3Provider.eth.getBlock(blockNumber)).timestamp,
    );

    let lockedFundsRatio =
      (blockTimestamp - lastReport) * lockedProfitDegradation;

    let calculatedLockedProfit;
    if (lockedFundsRatio < this.DEGRADATION_COEFFICIENT) {
      calculatedLockedProfit =
        lockedProfit -
        (lockedFundsRatio * lockedProfit) / this.DEGRADATION_COEFFICIENT;
    } else {
      calculatedLockedProfit = 0n;
    }

    let wbltFreeFunds = totalAssets - calculatedLockedProfit;
    let cacheValue = `${wbltFreeFunds.toString()},${aumInUsdg.toString()}`;
    this.dexHelper.cache.setex(
      this.parentName,
      this.network,
      cacheKey,
      MAX_AMOUNT_IN_CACHE_TTL,
      cacheValue,
    );

    return [wbltFreeFunds, aumInUsdg];
  }

  async buyWBLTAmountsOut(
    _tokenIn: Address,
    _wblt: Address,
    _amountsIn: bigint[],
    blockNumber: number,
  ): Promise<bigint[] | null> {
    const [wbltFreeFunds, aumInUsdg] = await this.getWbltFreeFundsAndAumInUsdg(
      _wblt,
      true,
      blockNumber,
    );
    const state = await this.getStateOrGenerate(blockNumber);
    const priceIn = this.vault.getMinPrice(state, _tokenIn);
    const tokenInDecimals = this.vault.tokenDecimals[_tokenIn];
    const USDGUnit = BigInt(10 ** this.USDG_DECIMALS);
    const tokenInUnit = BigInt(10 ** tokenInDecimals);
    const glpSupply = state.glp.totalSupply;
    const wbltTotalSupply = state.wblt.totalSupply;

    return _amountsIn.map(_amountIn => {
      let feeBasisPoints;
      {
        let usdgAmount = (_amountIn * priceIn) / this.PRICE_PRECISION;
        if (usdgAmount == 0n) return 0n;
        usdgAmount = (usdgAmount * USDGUnit) / tokenInUnit;

        feeBasisPoints = this.vault.getFeeBasisPoints(
          state,
          _tokenIn,
          usdgAmount,
          this.vault.mintBurnBasisPoints,
          this.vault.taxBasisPoints,
          true,
        );
      }
      const amountOutAfterFees =
        (_amountIn * (this.BASIS_POINTS_DIVISOR - feeBasisPoints)) /
        this.BASIS_POINTS_DIVISOR;

      let usdgMintAmount =
        (amountOutAfterFees * priceIn) / this.PRICE_PRECISION;
      usdgMintAmount = (usdgMintAmount * USDGUnit) / tokenInUnit;

      let bltMintAmount =
        aumInUsdg == BigInt(0)
          ? usdgMintAmount
          : (usdgMintAmount * glpSupply) / aumInUsdg;

      let wbltAmount = (bltMintAmount * wbltTotalSupply) / wbltFreeFunds;

      return wbltAmount;
    });
  }

  async sellWBLTAmountsOut(
    _tokenOut: Address,
    _wblt: Address,
    _amountsIn: bigint[],
    blockNumber: number,
  ): Promise<bigint[] | null> {
    const [wbltFreeFunds, aumInUsdg] = await this.getWbltFreeFundsAndAumInUsdg(
      _wblt,
      false,
      blockNumber,
    );
    const state = await this.getStateOrGenerate(blockNumber);
    const priceOut = this.vault.getMaxPrice(state, _tokenOut);
    return _amountsIn.map(_amountIn => {
      let value = (_amountIn * wbltFreeFunds) / state.wblt.totalSupply; // too small
      if (value == 0n) return 0n;
      let usdgAmount = (value * aumInUsdg) / state.glp.totalSupply; // too big
      let redemptionAmount = (usdgAmount * this.PRICE_PRECISION) / priceOut;
      const tokenOutDecimals = this.vault.tokenDecimals[_tokenOut];
      const tokenInUnit = BigInt(10 ** 18);
      const tokenOutUnit = BigInt(10 ** tokenOutDecimals);
      let amountOut = (redemptionAmount * tokenOutUnit) / tokenInUnit;
      let feeBasisPoints = this.vault.getFeeBasisPoints(
        state,
        _tokenOut,
        usdgAmount,
        this.vault.mintBurnBasisPoints,
        this.vault.taxBasisPoints,
        false,
      );
      let afterFeeAmount =
        (amountOut * (this.BASIS_POINTS_DIVISOR - feeBasisPoints)) /
        this.BASIS_POINTS_DIVISOR;
      return afterFeeAmount;
    });
  }

  // Reference to the original implementation
  // https://github.com/gmx-io/gmx-contracts/blob/master/contracts/peripherals/Reader.sol#L71
  async getAmountOut(
    _tokenIn: Address,
    _tokenOut: Address,
    _amountsIn: bigint[],
    blockNumber: number,
  ): Promise<bigint[] | null> {
    const maxAmountIn = await this.getMaxAmountIn(_tokenIn, _tokenOut);
    const state = await this.getStateOrGenerate(blockNumber);
    const priceIn = this.vault.getMinPrice(state, _tokenIn);
    const priceOut = this.vault.getMaxPrice(state, _tokenOut);

    const tokenInDecimals = this.vault.tokenDecimals[_tokenIn];
    const tokenOutDecimals = this.vault.tokenDecimals[_tokenOut];

    const isStableSwap =
      this.vault.stableTokens[_tokenIn] && this.vault.stableTokens[_tokenOut];
    const baseBps = isStableSwap
      ? this.vault.stableSwapFeeBasisPoints
      : this.vault.swapFeeBasisPoints;
    const taxBps = isStableSwap
      ? this.vault.stableTaxBasisPoints
      : this.vault.taxBasisPoints;
    const USDGUnit = BigInt(10 ** this.USDG_DECIMALS);
    const tokenInUnit = BigInt(10 ** tokenInDecimals);
    const tokenOutUnit = BigInt(10 ** tokenOutDecimals);

    return _amountsIn.map(_amountIn => {
      if (_amountIn > maxAmountIn) return 0n;
      let feeBasisPoints;
      {
        let usdgAmount = (_amountIn * priceIn) / this.PRICE_PRECISION;
        usdgAmount = (usdgAmount * USDGUnit) / tokenInUnit;

        const feesBasisPoints0 = this.vault.getFeeBasisPoints(
          state,
          _tokenIn,
          usdgAmount,
          baseBps,
          taxBps,
          true,
        );
        const feesBasisPoints1 = this.vault.getFeeBasisPoints(
          state,
          _tokenOut,
          usdgAmount,
          baseBps,
          taxBps,
          false,
        );
        // use the higher of the two fee basis points
        feeBasisPoints =
          feesBasisPoints0 > feesBasisPoints1
            ? feesBasisPoints0
            : feesBasisPoints1;
      }

      let amountOut = (_amountIn * priceIn) / priceOut;
      amountOut = (amountOut * tokenOutUnit) / tokenInUnit;

      const amountOutAfterFees =
        (amountOut * (this.BASIS_POINTS_DIVISOR - feeBasisPoints)) /
        this.BASIS_POINTS_DIVISOR;
      return amountOutAfterFees;
    });
  }

  static async getWhitelistedTokens(
    vaultAddress: Address,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ) {
    // get tokens count
    const tokenCountResult = (
      await multiContract.methods
        .aggregate([
          {
            callData: Vault.interface.encodeFunctionData(
              'allWhitelistedTokensLength',
            ),
            target: vaultAddress,
          },
        ])
        .call({}, blockNumber)
    ).returnData;
    const tokensCount = parseInt(
      Vault.interface
        .decodeFunctionResult('allWhitelistedTokensLength', tokenCountResult[0])
        .toString(),
    );

    // get tokens
    const getTokensCalldata = new Array(tokensCount).fill(0).map((_, i) => {
      return {
        callData: Vault.interface.encodeFunctionData('allWhitelistedTokens', [
          i,
        ]),
        target: vaultAddress,
      };
    });
    const tokensResult = (
      await multiContract.methods
        .aggregate(getTokensCalldata)
        .call({}, blockNumber)
    ).returnData;
    const tokens: Address[] = tokensResult.map((t: any) =>
      Vault.interface
        .decodeFunctionResult('allWhitelistedTokens', t)[0]
        .toLowerCase(),
    );
    return tokens;
  }

  static async getConfig(
    dexParams: DexParams,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ): Promise<PoolConfig> {
    const tokens = await this.getWhitelistedTokens(
      dexParams.vault,
      blockNumber,
      multiContract,
    );

    // get price chainlink price feed
    const getPriceFeedCalldata = tokens.map(t => {
      return {
        callData: VaultPriceFeed.interface.encodeFunctionData('priceFeeds', [
          t,
        ]),
        target: dexParams.priceFeed,
      };
    });
    const priceFeedResult = (
      await multiContract.methods
        .aggregate(getPriceFeedCalldata)
        .call({}, blockNumber)
    ).returnData;
    const priceFeeds = priceFeedResult.map((p: any) =>
      VaultPriceFeed.interface
        .decodeFunctionResult('priceFeeds', p)[0]
        .toString()
        .toLowerCase(),
    );

    // get config for all event listeners
    let multicallSlices: [number, number][] = [];
    let multiCallData: MultiCallInput[] = [];
    let i = 0;
    for (let priceFeed of priceFeeds) {
      const chainlinkConfigCallData =
        ChainLinkSubscriber.getReadAggregatorMultiCallInput(priceFeed);
      multiCallData.push(chainlinkConfigCallData);
      multicallSlices.push([i, i + 1]);
      i += 1;
    }

    const fastPriceFeedConfigCallData = FastPriceFeed.getConfigMulticallInputs(
      dexParams.fastPriceFeed,
      tokens,
    );
    multiCallData.push(...fastPriceFeedConfigCallData);
    multicallSlices.push([i, i + fastPriceFeedConfigCallData.length]);
    i += fastPriceFeedConfigCallData.length;

    const vaultPriceFeedConfigCallData =
      VaultPriceFeed.getConfigMulticallInputs(dexParams.priceFeed, tokens);
    multiCallData.push(...vaultPriceFeedConfigCallData);
    multicallSlices.push([i, i + vaultPriceFeedConfigCallData.length]);
    i += vaultPriceFeedConfigCallData.length;

    const vaultConfigCallData = Vault.getConfigMulticallInputs(
      dexParams.vault,
      tokens,
    );
    multiCallData.push(...vaultConfigCallData);
    multicallSlices.push([i, i + vaultConfigCallData.length]);
    i += vaultConfigCallData.length;

    const configResults = (
      await multiContract.methods.aggregate(multiCallData).call({}, blockNumber)
    ).returnData;

    const chainlink: {
      [address: string]: { proxy: Address; aggregator: Address };
    } = {};
    for (let token of tokens) {
      const aggregator = ChainLinkSubscriber.readAggregator(
        configResults.slice(...multicallSlices.shift()!)[0],
      );
      chainlink[token] = {
        proxy: priceFeeds.shift(),
        aggregator,
      };
    }

    const fastPriceFeedConfigResults = configResults.slice(
      ...multicallSlices.shift()!,
    );
    const fastPriceFeedConfig = FastPriceFeed.getConfig(
      fastPriceFeedConfigResults,
      tokens,
    );

    const vaultPriceFeedConfigResults = configResults.slice(
      ...multicallSlices.shift()!,
    );
    const vaultPriceFeedConfig = VaultPriceFeed.getConfig(
      vaultPriceFeedConfigResults,
      tokens,
    );

    const vaultConfigResults = configResults.slice(...multicallSlices.shift()!);
    const vaultConfig = Vault.getConfig(vaultConfigResults, tokens);

    return {
      wbltAddress: dexParams.wblt,
      glpAddress: dexParams.glpAddress,
      glpManager: dexParams.glpManager,
      vaultAddress: dexParams.vault,
      readerAddress: dexParams.reader,
      priceFeed: dexParams.priceFeed,
      fastPriceFeed: dexParams.fastPriceFeed,
      fastPriceEvents: dexParams.fastPriceEvents,
      usdgAddress: dexParams.usdg,
      tokenAddresses: tokens,
      vaultConfig,
      vaultPriceFeedConfig,
      fastPriceFeedConfig,
      chainlink,
    };
  }
}
