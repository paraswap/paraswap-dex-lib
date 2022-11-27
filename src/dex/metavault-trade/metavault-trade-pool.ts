import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Contract } from 'web3-eth-contract';
import ReaderABI from '../../abi/metavault-trade/reader.json';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { lens } from '../../lens';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { Address, Log, Logger, MultiCallInput } from '../../types';
import { DexParams, PoolConfig, PoolState } from './types';
import { FastPriceFeed } from './fast-price-feed';
import { USDM } from './usdm';
import { Vault } from './vault';
import { VaultPriceFeed } from './vault-price-feed';

const MAX_AMOUNT_IN_CACHE_TTL = 5 * 60;

export class MetavaultTradeEventPool extends ComposedEventSubscriber<PoolState> {
  PRICE_PRECISION = 10n ** 30n;
  USDM_DECIMALS = 18;
  BASIS_POINTS_DIVISOR = 10000n;

  vault: Vault<PoolState>;
  reader: Contract;

  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

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

    const usdm = new USDM(
      config.usdmAddress,
      lens<DeepReadonly<PoolState>>().usdm,
      dexHelper.getLogger(`${parentName}-${network} USDG`),
    );

    const vault = new Vault(
      config.vaultAddress,
      config.tokenAddresses,
      config.vaultConfig,
      vaultPriceFeed,
      usdm,
      lens<DeepReadonly<PoolState>>().vault,
      dexHelper.getLogger(`${parentName}-${network} vault`),
    );

    super(
      'MetavaultTradePool',
      dexHelper.getLogger(`${parentName}-${network}`),
      dexHelper,
      [...Object.values(chainlinkMap), fastPriceFeed, usdm, vault],
      {
        primaryPrices: {},
        secondaryPrices: {
          lastUpdatedAt: 0,
          prices: {},
        },
        vault: {
          usdmAmounts: {},
        },
        usdm: {
          totalSupply: 0n,
        },
      },
    );

    this.vault = vault;
    this.reader = new this.dexHelper.web3Provider.eth.Contract(
      ReaderABI as any,
      config.readerAddress,
    );
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
      this.name,
      this.network,
      cacheKey,
    );

    if (maxAmountCached) return BigInt(maxAmountCached);

    const maxAmount: string = await this.reader.methods
      .getMaxAmountIn(this.vault.vaultAddress, _tokenIn, _tokenOut)
      .call();
    this.dexHelper.cache.setex(
      this.name,
      this.network,
      cacheKey,
      MAX_AMOUNT_IN_CACHE_TTL,
      maxAmount,
    );
    return BigInt(maxAmount);
  }

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
    const USDMUnit = BigInt(10 ** this.USDM_DECIMALS);
    const tokenInUnit = BigInt(10 ** tokenInDecimals);
    const tokenOutUnit = BigInt(10 ** tokenOutDecimals);

    return _amountsIn.map(_amountIn => {
      if (_amountIn > maxAmountIn) return 0n;
      let feeBasisPoints;
      {
        let usdmAmount = (_amountIn * priceIn) / this.PRICE_PRECISION;
        usdmAmount = (usdmAmount * USDMUnit) / tokenInUnit;

        const feesBasisPoints0 = this.vault.getFeeBasisPoints(
          state,
          _tokenIn,
          usdmAmount,
          baseBps,
          taxBps,
          true,
        );
        const feesBasisPoints1 = this.vault.getFeeBasisPoints(
          state,
          _tokenOut,
          usdmAmount,
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

  static async getPriceFeedsForTokens(
    tokens: string[],
    vaultPriceFeedAddress: Address,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ) {
    const getPriceFeedCalldata = tokens.map(t => ({
      callData: VaultPriceFeed.interface.encodeFunctionData('priceFeeds', [t]),
      target: vaultPriceFeedAddress,
    }));

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

    return priceFeeds;
  }

  static async getContractConfigs(
    priceFeeds: string[],
    tokens: string[],
    dexParams: DexParams,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ) {
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
        proxy: priceFeeds.shift() || '',
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
      fastPriceFeedConfig,
      vaultPriceFeedConfig,
      vaultConfig,
      chainlink,
    };
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
    const priceFeeds = await this.getPriceFeedsForTokens(
      tokens,
      dexParams.priceFeed,
      blockNumber,
      multiContract,
    );
    const configResults = await this.getContractConfigs(
      priceFeeds,
      tokens,
      dexParams,
      blockNumber,
      multiContract,
    );

    const {
      fastPriceFeedConfig,
      vaultPriceFeedConfig,
      vaultConfig,
      chainlink,
    } = configResults;

    return {
      vaultAddress: dexParams.vault,
      readerAddress: dexParams.reader,
      priceFeed: dexParams.priceFeed,
      fastPriceFeed: dexParams.fastPriceFeed,
      fastPriceEvents: dexParams.fastPriceEvents,
      usdmAddress: dexParams.usdm,
      tokenAddresses: tokens,
      vaultConfig,
      vaultPriceFeedConfig,
      fastPriceFeedConfig,
      chainlink,
    };
  }
}
