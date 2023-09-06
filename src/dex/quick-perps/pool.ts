import { DeepReadonly } from 'ts-essentials';
import { lens } from '../../lens';
import { Address, Logger, MultiCallInput } from '../../types';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, DexParams, PoolConfig } from './types';
import { Api3FeedSubscriber } from '../../lib/api3-feed';
import { FastPriceFeed } from './fast-price-feed';
import { VaultPriceFeed } from './vault-price-feed';
import { Vault } from './vault';
import { USDQ } from './usdq';
import { Contract } from 'web3-eth-contract';
import ReaderABI from '../../abi/quick-perps/reader.json';

const MAX_AMOUNT_IN_CACHE_TTL = 5 * 60;

export class QuickPerpsEventPool extends ComposedEventSubscriber<PoolState> {
  PRICE_PRECISION = 10n ** 30n;
  USDQ_DECIMALS = 18;
  BASIS_POINTS_DIVISOR = 10000n;

  vault: Vault<PoolState>;
  reader: Contract;

  constructor(
    parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    config: PoolConfig,
  ) {
    const api3ServerV1Map = Object.entries(config.api3ServerV1).reduce(
      (
        acc: { [address: string]: Api3FeedSubscriber<PoolState> },
        [key, value],
      ) => {
        acc[key] = new Api3FeedSubscriber<PoolState>(
          value.proxy,
          value.api3ServerV1,
          value.dataFeedId,
          lens<DeepReadonly<PoolState>>().primaryPrices[key],
          dexHelper.getLogger(
            `${key} Api3FeedSubscriber for ${parentName}-${network}`,
          ),
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
      api3ServerV1Map,
      fastPriceFeed,
    );
    const usdq = new USDQ(
      config.usdqAddress,
      lens<DeepReadonly<PoolState>>().usdq,
      dexHelper.getLogger(`${parentName}-${network} USDQ`),
    );
    const vault = new Vault(
      config.vaultAddress,
      config.tokenAddresses,
      config.vaultConfig,
      vaultPriceFeed,
      usdq,
      lens<DeepReadonly<PoolState>>().vault,
      dexHelper.getLogger(`${parentName}-${network} vault`),
    );
    super(
      parentName,
      'pool',
      dexHelper.getLogger(`${parentName}-${network}`),
      dexHelper,
      [...Object.values(api3ServerV1Map), fastPriceFeed, usdq, vault],
      {
        primaryPrices: {},
        secondaryPrices: {
          lastUpdatedAt: 0,
          prices: {},
        },
        vault: {
          usdqAmounts: {},
        },
        usdq: {
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
    const USDQUnit = BigInt(10 ** this.USDQ_DECIMALS);
    const tokenInUnit = BigInt(10 ** tokenInDecimals);
    const tokenOutUnit = BigInt(10 ** tokenOutDecimals);

    return _amountsIn.map(_amountIn => {
      if (_amountIn > maxAmountIn) return 0n;
      let feeBasisPoints;
      {
        let usdqAmount = (_amountIn * priceIn) / this.PRICE_PRECISION;
        usdqAmount = (usdqAmount * USDQUnit) / tokenInUnit;

        const feesBasisPoints0 = this.vault.getFeeBasisPoints(
          state,
          _tokenIn,
          usdqAmount,
          baseBps,
          taxBps,
          true,
        );
        const feesBasisPoints1 = this.vault.getFeeBasisPoints(
          state,
          _tokenOut,
          usdqAmount,
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
        callData: VaultPriceFeed.interface.encodeFunctionData(
          'priceFeedProxies',
          [t],
        ),
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
        .decodeFunctionResult('priceFeedProxies', p)[0]
        .toString()
        .toLowerCase(),
    );

    // get config for all event listeners
    let multicallSlices: [number, number][] = [];
    let multiCallData: MultiCallInput[] = [];
    let i = 0;
    for (let priceFeed of priceFeeds) {
      const api3ServerAddressCallData =
        Api3FeedSubscriber.getApi3ServerV1MultiCallInput(priceFeed);
      const dataFeedIdCallData = Api3FeedSubscriber.getDataFeedId(priceFeed);
      multiCallData.push(...[api3ServerAddressCallData, dataFeedIdCallData]);
      multicallSlices.push([i, i + 2]);
      i += 2;
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

    const api3ServerV1: {
      [address: string]: {
        proxy: Address;
        api3ServerV1: Address;
        dataFeedId: string;
      };
    } = {};
    for (let token of tokens) {
      const [api3ServerAddressRes, dataFeedIdRes] = configResults.slice(
        ...multicallSlices.shift()!,
      );
      const serverV1Address =
        Api3FeedSubscriber.decodeApi3ServerV1Result(api3ServerAddressRes);
      const dataFeedId = Api3FeedSubscriber.decodeDataFeedId(dataFeedIdRes);
      api3ServerV1[token] = {
        proxy: priceFeeds.shift(),
        api3ServerV1: serverV1Address,
        dataFeedId,
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
      vaultAddress: dexParams.vault,
      readerAddress: dexParams.reader,
      priceFeed: dexParams.priceFeed,
      fastPriceFeed: dexParams.fastPriceFeed,
      fastPriceEvents: dexParams.fastPriceEvents,
      usdqAddress: dexParams.usdq,
      tokenAddresses: tokens,
      vaultConfig,
      vaultPriceFeedConfig,
      fastPriceFeedConfig,
      api3ServerV1,
    };
  }
}
