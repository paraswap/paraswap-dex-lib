import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  PoolLiquidity,
  Logger,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolConfig, PoolsConfig, StabullData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, StabullConfig } from './config';
import { StabullEventPool } from './stabull-pool';
import curveABI from '../../abi/stabull/stabull-curve.json';
import routerABI from '../../abi/stabull/stabull-router.json';
import { AbiItem } from 'web3-utils';
import { ethers } from 'ethers';

export class Stabull extends SimpleExchange implements IDex<StabullData> {
  private pools: any = {};
  private poolsConfig: PoolsConfig;

  // protected eventPools: StabullEventPool;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(StabullConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.poolsConfig = StabullConfig.Stabull[network].pools;

    //Iterate over pools and Initialize event pools
    Object.keys(this.poolsConfig).forEach(poolAddress => {
      const pool = this.poolsConfig[poolAddress];
      const tokens = pool.tokens;

      // Initialize event pools
      this.pools[poolAddress] = new StabullEventPool(
        dexKey,
        network,
        dexHelper,
        poolAddress,
        tokens,
        this.logger,
      );
    });
  }

  // Legacy: was only used for V5
  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    // Try to find a direct pool first

    if (!srcToken || !destToken) {
      this.logger.error(
        `Missing tokens: srcToken=${!!srcToken}, destToken=${!!destToken}`,
      );
      return [];
    }

    // Add address null checks
    if (!srcToken.address || !destToken.address) {
      this.logger.error(
        `Missing token addresses: srcToken.address=${!!srcToken.address}, destToken.address=${!!destToken.address}`,
      );
      return [];
    }
    const directPool = this.findPoolForTokens(
      srcToken.address,
      destToken.address,
    );

    if (directPool) {
      // Direct swap is possible
      return [`${this.dexKey}_${directPool.toLowerCase()}_direct`];
    }

    // If no direct pool exists, try to find a path through the quote currency (USDC)
    const stabullConfig = StabullConfig.Stabull[this.network];
    const quoteCurrency = stabullConfig.quoteCurrency;

    // Find pools for srcToken -> USDC and USDC -> destToken
    const srcToQuotePool = this.findPoolForTokens(
      srcToken.address,
      quoteCurrency,
    );

    const quoteToDestPool = this.findPoolForTokens(
      quoteCurrency,
      destToken.address,
    );

    if (srcToQuotePool && quoteToDestPool) {
      // Multi-hop swap is possible
      return [
        `${
          this.dexKey
        }_${srcToQuotePool.toLowerCase()}_${quoteToDestPool.toLowerCase()}_multihop`,
      ];
    }

    this.logger.debug(
      `No path found for ${srcToken.address}/${destToken.address}`,
    );
    return [];
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<StabullData>> {
    const pools = await this.getPoolIdentifiers(
      srcToken,
      destToken,
      side,
      blockNumber,
    );

    if (pools.length === 0) {
      return null;
    }

    const poolIdentifier = pools[0];
    const poolParts = poolIdentifier.split('_');
    const isMultiHop = poolParts.length === 4 && poolParts[3] === 'multihop';

    try {
      if (!isMultiHop) {
        // Direct swap case
        const poolAddress = poolParts[1];
        const methodName =
          side === SwapSide.SELL ? 'viewOriginSwap' : 'viewTargetSwap';

        // Create contract interface once outside the loop
        const poolContract = new this.dexHelper.web3Provider.eth.Contract(
          curveABI as unknown as AbiItem,
          poolAddress,
        );

        // Prepare all call entries at once
        const callData = amounts.map(amount => ({
          target: poolAddress,
          callData: poolContract.methods[methodName](
            srcToken.address,
            destToken.address,
            amount.toString(),
          ).encodeABI(),
        }));

        // Execute multicall in a single transaction
        const { returnData } = await this.dexHelper.multiContract.methods
          .aggregate(callData)
          .call();

        // Process all results at once
        const quotes = returnData.map((data: any) =>
          this.dexHelper.web3Provider.eth.abi
            .decodeParameter('uint256', data)
            .toString(),
        );

        return [
          {
            prices: quotes.map((quote: any) => BigInt(quote.toString())),
            unit: amounts[0],
            data: {
              exchange: poolAddress,
              poolAddress: poolAddress,
              factory: '', // Replace with actual factory address if available
              secondPoolAddress: '',
              quoteCurrency: '',
              isMultihop: false,
            },
            exchange: this.dexKey,
            gasCost: 150000, // Estimated gas cost for a swap
            poolAddresses: [poolAddress],
          },
        ];
      } else {
        // Multi-hop swap case
        const stabullConfig = StabullConfig.Stabull[this.network];
        const quoteCurrency = stabullConfig.quoteCurrency;

        const srcToQuotePoolAddress = poolParts[1];
        const quoteToDestPoolAddress = poolParts[2];

        const srcToQuoteContract = new this.dexHelper.web3Provider.eth.Contract(
          curveABI as unknown as AbiItem,
          srcToQuotePoolAddress,
        );

        const quoteToDestContract =
          new this.dexHelper.web3Provider.eth.Contract(
            curveABI as unknown as AbiItem,
            quoteToDestPoolAddress,
          );

        let quotes;

        if (side === SwapSide.SELL) {
          // First multicall: srcToken -> USDC
          const firstHopCalls = amounts.map(amount => ({
            target: srcToQuotePoolAddress,
            callData: srcToQuoteContract.methods
              .viewOriginSwap(
                srcToken.address,
                quoteCurrency,
                amount.toString(),
              )
              .encodeABI(),
          }));

          const { returnData: firstHopData } =
            await this.dexHelper.multiContract.methods
              .aggregate(firstHopCalls)
              .call();

          const quoteAmounts = firstHopData.map((data: string) =>
            this.dexHelper.web3Provider.eth.abi
              .decodeParameter('uint256', data)
              .toString(),
          );

          // Second multicall: USDC -> destToken
          const secondHopCalls = quoteAmounts.map((quoteAmount: any) => ({
            target: quoteToDestPoolAddress,
            callData: quoteToDestContract.methods
              .viewOriginSwap(quoteCurrency, destToken.address, quoteAmount)
              .encodeABI(),
          }));

          const { returnData: secondHopData } =
            await this.dexHelper.multiContract.methods
              .aggregate(secondHopCalls)
              .call();

          quotes = secondHopData.map((data: any) =>
            this.dexHelper.web3Provider.eth.abi
              .decodeParameter('uint256', data)
              .toString(),
          );
        } else {
          // BUY side - First multicall: USDC -> destToken (reverse calculation)
          const firstHopCalls = amounts.map(amount => ({
            target: quoteToDestPoolAddress,
            callData: quoteToDestContract.methods
              .viewTargetSwap(
                quoteCurrency,
                destToken.address,
                amount.toString(),
              )
              .encodeABI(),
          }));

          const { returnData: firstHopData } =
            await this.dexHelper.multiContract.methods
              .aggregate(firstHopCalls)
              .call();

          const quoteAmounts = firstHopData.map((data: any) =>
            this.dexHelper.web3Provider.eth.abi
              .decodeParameter('uint256', data)
              .toString(),
          );

          // Second multicall: srcToken -> USDC (reverse calculation)
          const secondHopCalls = quoteAmounts.map((quoteAmount: any) => ({
            target: srcToQuotePoolAddress,
            callData: srcToQuoteContract.methods
              .viewTargetSwap(srcToken.address, quoteCurrency, quoteAmount)
              .encodeABI(),
          }));

          const { returnData: secondHopData } =
            await this.dexHelper.multiContract.methods
              .aggregate(secondHopCalls)
              .call();

          quotes = secondHopData.map((data: string) =>
            this.dexHelper.web3Provider.eth.abi
              .decodeParameter('uint256', data)
              .toString(),
          );
        }

        return [
          {
            prices: quotes.map((quote: any) => BigInt(quote.toString())),
            unit: amounts[0],
            data: {
              exchange: srcToQuotePoolAddress, // Using the first pool as the exchange
              poolAddress: srcToQuotePoolAddress,
              secondPoolAddress: quoteToDestPoolAddress,
              factory: '', // Replace with actual factory address if available
              quoteCurrency: quoteCurrency,
              isMultihop: true,
            },
            exchange: this.dexKey,
            gasCost: 300000, // Estimated gas cost for a multi-hop swap (higher than single swap)
            poolAddresses: [srcToQuotePoolAddress, quoteToDestPoolAddress],
          },
        ];
      }
    } catch (e) {
      this.logger.error('Failed to get prices', e);
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<StabullData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
  // Update this method to use the correct AbiCoder syntax
  getAdapterParam = (
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: StabullData,
    side: SwapSide,
  ): AdapterExchangeParam => {
    // Use ethers.utils.defaultAbiCoder instead of this.abiCoder
    const payload = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256'],
      [data.poolAddress, side === SwapSide.SELL ? srcAmount : destAmount, 0],
    );

    return {
      targetExchange: StabullConfig.Stabull[this.network].router,
      payload,
      networkFee: '0',
    };
  };

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    // For now, we'll return a constant value for any pools that contain this token
    const relevantPools: PoolLiquidity[] = [];

    // Convert the token address to lowercase for consistent comparison
    const lowerTokenAddress = tokenAddress.toLowerCase();

    // Loop through our configured pools to find ones containing the requested token
    Object.keys(this.poolsConfig).forEach(poolAddress => {
      const pool = this.pools[poolAddress];

      // Check if the pool contains the token
      const hasToken = pool.addressesSubscribed
        .map((token: any) => token.toLowerCase())
        .includes(lowerTokenAddress);

      if (hasToken) {
        // Get the other tokens in the pool as connector tokens
        const connectorTokens = pool.addressesSubscribed
          .filter((token: any) => token.toLowerCase() !== lowerTokenAddress)
          .map((tokenAddress: any) => this.getTokenFromAddress(tokenAddress));
        const state = pool.getState();
        relevantPools.push({
          exchange: this.dexKey,
          address: poolAddress,
          connectorTokens: connectorTokens,
          liquidityUSD: state.reserves1,
        });

        // Break if we've reached the limit
        if (relevantPools.length >= limit) {
          return relevantPools;
        }
      }
    });

    this.logger.info(
      `Found ${relevantPools.length} pools for token ${tokenAddress}`,
    );
    return relevantPools;
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }

  // ====================================New functions=============================================

  /**
   * Loads pool information from a config file
   * @param blockNumber Not needed when using config, but kept for interface consistency
   * @returns Array of pool information objects
   */
  async fetchPoolsFromFactory(blockNumber: number): Promise<any[]> {
    try {
      // Extract the pools configuration for the current network
      const networkConfig = StabullConfig.Stabull[this.network];
      if (!networkConfig) {
        this.logger.error(
          `No configuration found for network: ${this.network}`,
        );
        return [];
      }

      // Map the pools configuration to the desired format
      const pools = Object.values(networkConfig.pools).map(poolConfig => {
        return {
          address: poolConfig.pool,
          tokens: poolConfig.tokens,
          // Add any other relevant pool information from your config
        };
      });

      this.logger.info(`Loaded ${pools.length} pools from config`);
      return pools;
    } catch (error) {
      this.logger.error(`Error loading pools from config: ${error}`);
      return [];
    }
  }

  /**
   * Finds the pool address for the given source and destination token addresses.
   *
   * @param srcTokenAddress - The address of the source token.
   * @param destTokenAddress - The address of the destination token.
   * @returns The pool address if a pool containing both tokens is found, otherwise null.
   */
  findPoolForTokens(
    srcTokenAddress: string,
    destTokenAddress: string,
  ): string | null {
    const lowerSrcTokenAddress = srcTokenAddress.toLowerCase();
    const lowerDestTokenAddress = destTokenAddress.toLowerCase();

    const foundPoolAddress = Object.keys(this.poolsConfig).find(poolAddress => {
      const pool = this.poolsConfig[poolAddress];
      const lowercaseTokens = pool.tokens.map(token => token.toLowerCase());

      // Check if both tokens are in the pool
      return (
        lowercaseTokens.includes(lowerSrcTokenAddress) &&
        lowercaseTokens.includes(lowerDestTokenAddress)
      );
    });

    return foundPoolAddress || null;
  }

  /**
   * Retrieves the decentralized exchange (DEX) parameters for a swap operation.
   *
   * @param srcToken - The address of the source token.
   * @param destToken - The address of the destination token.
   * @param srcAmount - The amount of the source token to swap.
   * @param destAmount - The desired amount of the destination token.
   * @param recipient - The address of the recipient.
   * @param data - Additional data required for the swap.
   * @param side - The side of the swap (SELL or BUY).
   * @param options - Options for global tokens.
   * @param executorAddress - The address of the executor.
   * @returns A promise that resolves to the DEX exchange parameters.
   */
  async getDexParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    recipient: string,
    data: StabullData,
    side: SwapSide,
    options: {
      isGlobalSrcToken: boolean;
      isGlobalDestToken: boolean;
    },
    executorAddress: string,
  ): Promise<DexExchangeParam> {
    // Get Stabull configuration for this network
    const stabullConfig = StabullConfig.Stabull[this.network];
    const routerAddress = stabullConfig.router;
    const quoteCurrency = stabullConfig.quoteCurrency;

    // Set a reasonable deadline
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

    // For SELL operations, always use the router for swaps
    if (side === SwapSide.SELL) {
      const routerInterface = new ethers.utils.Interface(routerABI);

      const swapData = routerInterface.encodeFunctionData('originSwap', [
        quoteCurrency, // quoteCurrency
        srcToken, // origin
        destToken, // target
        srcAmount, // originAmount
        '1', // minTargetAmount - set to minimum to ensure execution
        deadline, // deadline
      ]);

      return {
        needWrapNative: this.needWrapNative,
        dexFuncHasRecipient: false,
        exchangeData: swapData,
        targetExchange: routerAddress,
        spender: routerAddress,
        returnAmountPos: 0,
      };
    }

    if (data.isMultihop) {
      // Multi-hop BUY operation (srcToken -> USDC -> destToken)

      // Use the viewTargetSwap function to calculate the amount of srcToken needed
      const routerInterface = new ethers.utils.Interface(routerABI);

      // Calculate the amount of srcToken needed to get the desired destAmount via USDC
      const srcAmountNeededResult = await this.dexHelper.web3Provider.eth.call({
        to: routerAddress,
        data: routerInterface.encodeFunctionData('viewTargetSwap', [
          quoteCurrency, // _quoteCurrency
          srcToken, // _origin
          destToken, // _target
          destAmount, // _targetAmount
        ]),
      });

      // Parse the result to get the srcToken amount needed
      const srcAmountNeeded = routerInterface
        .decodeFunctionResult('viewTargetSwap', srcAmountNeededResult)[0]
        .toString();

      // Using originSwap on the router for multi-hop BUY
      const swapData = routerInterface.encodeFunctionData('originSwap', [
        quoteCurrency, // quoteCurrency (required by the router to identify the path)
        srcToken, // origin
        destToken, // target
        srcAmountNeeded, // originAmount (calculated amount needed)
        destAmount, // minTargetAmount (ensure we get at least this amount)
        deadline, // deadline
      ]);

      // For multi-hop BUY operations, we'll use the router
      // with our calculated srcAmount to ensure we get the desired destAmount
      return {
        needWrapNative: this.needWrapNative,
        dexFuncHasRecipient: false,
        exchangeData: swapData,
        targetExchange: routerAddress, // Use router for multi-hop coordination
        spender: routerAddress, // Router needs approval for srcToken
        returnAmountPos: 0,
      };
    } else {
      // Direct swap case for BUY operations (one token must be quote currency)
      const poolAddress = data.poolAddress || data.exchange;

      if (!poolAddress) {
        this.logger.error(
          `Missing pool address for BUY operation with tokens: ${srcToken} -> ${destToken}`,
        );
        throw new Error('Pool address is required for BUY operations');
      }

      // Verify that one of the tokens is the quote currency
      if (
        srcToken.toLowerCase() !== quoteCurrency.toLowerCase() &&
        destToken.toLowerCase() !== quoteCurrency.toLowerCase()
      ) {
        this.logger.error(
          `For direct BUY operations, one token must be the quote currency (${quoteCurrency})`,
        );
        throw new Error(
          `Direct target swaps require one token to be ${quoteCurrency}`,
        );
      }

      const poolInterface = new ethers.utils.Interface(curveABI);

      const swapData = poolInterface.encodeFunctionData('targetSwap', [
        srcToken, // origin
        destToken, // target
        ethers.constants.MaxUint256.toString(), // maxOriginAmount
        destAmount, // targetAmount
        deadline, // deadline
      ]);

      return {
        needWrapNative: this.needWrapNative,
        dexFuncHasRecipient: false,
        exchangeData: swapData,
        targetExchange: poolAddress,
        spender: poolAddress,
        returnAmountPos: 0,
      };
    }
  }

  /**
   * Determines if two tokens share a curve based on the pool configuration.
   *
   * @param token1 - The address of the first token.
   * @param token2 - The address of the second token.
   * @param poolConfig - The configuration of the pool.
   * @returns True if both tokens are in the pool, otherwise false.
   */
  tokensShareCurve(
    token1: string,
    token2: string,
    poolConfig: PoolConfig,
  ): boolean {
    // Convert tokens to lowercase for comparison
    const lowerCaseToken1 = token1.toLowerCase();
    const lowerCaseToken2 = token2.toLowerCase();
    const lowerCasePoolTokens = poolConfig.tokens.map(token =>
      token.toLowerCase(),
    );

    // Check if both tokens are in the tokens array of this pool
    const token1Included = lowerCasePoolTokens.includes(lowerCaseToken1);
    const token2Included = lowerCasePoolTokens.includes(lowerCaseToken2);

    return token1Included && token2Included;
  }

  /**
   * Finds the appropriate curve (pool) for a given token pair.
   *
   * @param token1 - The address of the first token.
   * @param token2 - The address of the second token.
   * @returns The address of the curve (pool) if found, otherwise throws an error.
   */
  findCurveForTokenPair(token1: string, token2: string): string {
    const foundPoolAddress = Object.keys(this.poolsConfig).find(poolAddress =>
      this.tokensShareCurve(token1, token2, this.poolsConfig[poolAddress]),
    );

    if (!foundPoolAddress) {
      throw new Error(`No curve found for token pair ${token1}/${token2}`);
    }

    return this.poolsConfig[foundPoolAddress].pool;
  }

  /**
   * Calculates the required intermediary amount for a multi-hop swap.
   *
   * @param intermediaryToken - The address of the intermediary token.
   * @param destToken - The address of the destination token.
   * @param destAmount - The desired amount of the destination token.
   * @param curveAddress - The address of the curve (pool).
   * @returns A promise that resolves to the required intermediary amount.
   */
  async getRequiredIntermediaryAmount(
    intermediaryToken: string,
    destToken: string,
    destAmount: string,
    curveAddress: string,
  ): Promise<string> {
    // This would make an actual call to the viewTargetSwap function on the curve
    // to get the required amount of intermediary token

    // For example (pseudocode):
    const curveInterface = new ethers.utils.Interface([
      'function viewTargetSwap(address origin, address target, uint256 targetAmount) view returns (uint256)',
    ]);

    const encodedCall = curveInterface.encodeFunctionData('viewTargetSwap', [
      intermediaryToken,
      destToken,
      destAmount,
    ]);

    const result = await this.dexHelper.provider.call({
      to: curveAddress,
      data: encodedCall,
    });

    return curveInterface
      .decodeFunctionResult('viewTargetSwap', result)[0]
      .toString();
  }

  /**
   * Returns the allowance target address for a token pair.
   *
   * @param srcToken - The address of the source token.
   * @param destToken - The address of the destination token.
   * @returns The allowance target address (router address).
   */
  getAllowanceTarget(srcToken: string, destToken: string): string {
    return StabullConfig.Stabull[this.network].router;
  }

  /**
   * Retrieves token details from its address.
   *
   * @param address - The address of the token.
   * @returns The token details, including address, decimals, and symbol.
   */
  getTokenFromAddress(address: string): Token {
    // Check if this is the native token address
    if (
      address.toLowerCase() ===
      '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase()
    ) {
      return {
        address,
        decimals: 18,
        symbol: 'ETH',
      };
    }

    return {
      address,
      decimals: 6,
      symbol: '',
    };
  }
}
