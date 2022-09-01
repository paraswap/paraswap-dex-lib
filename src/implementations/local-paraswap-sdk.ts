import * as _ from 'lodash';
import {
  DummyDexHelper,
  DummyLimitOrderProvider,
  IDexHelper,
} from '../dex-helper';
import BigNumber from 'bignumber.js';
import { TransactionBuilder } from '../transaction-builder';
import { PricingHelper } from '../pricing-helper';
import { DexAdapterService } from '../dex';
import { Address, Token, OptimalRate, TxObject } from '../types';
import { SwapSide, NULL_ADDRESS, ContractMethod } from '../constants';
import { LimitOrderExchange } from '../dex/limit-order-exchange';

export interface IParaSwapSDK {
  getPrices(
    from: Token,
    to: Token,
    amount: bigint,
    side: SwapSide,
    contractMethod: ContractMethod,
    _poolIdentifiers?: string[],
  ): Promise<OptimalRate>;

  buildTransaction(
    priceRoute: OptimalRate,
    minMaxAmount: BigInt,
    userAddress: Address,
  ): Promise<TxObject>;

  initializePricing?(): Promise<void>;

  releaseResources?(): Promise<void>;
}

const chunks = 10;

export class LocalParaswapSDK implements IParaSwapSDK {
  dexHelper: IDexHelper;
  dexAdapterService: DexAdapterService;
  pricingHelper: PricingHelper;
  transactionBuilder: TransactionBuilder;

  constructor(
    protected network: number,
    protected dexKey: string,
    limitOrderProvider?: DummyLimitOrderProvider,
  ) {
    this.dexHelper = new DummyDexHelper(this.network);
    this.dexAdapterService = new DexAdapterService(
      this.dexHelper,
      this.network,
    );
    this.pricingHelper = new PricingHelper(
      this.dexAdapterService,
      this.dexHelper.getLogger,
    );
    this.transactionBuilder = new TransactionBuilder(this.dexAdapterService);

    const dex = this.dexAdapterService.getDexByKey(dexKey);
    if (limitOrderProvider && dex instanceof LimitOrderExchange) {
      dex.limitOrderProvider = limitOrderProvider;
    }
  }

  async initializePricing() {
    const blockNumber = await this.dexHelper.web3Provider.eth.getBlockNumber();
    await this.pricingHelper.initialize(blockNumber, [this.dexKey]);
  }

  async releaseResources() {
    await this.pricingHelper.releaseResources([this.dexKey]);
  }

  async getPrices(
    from: Token,
    to: Token,
    amount: bigint,
    side: SwapSide,
    contractMethod: ContractMethod,
    _poolIdentifiers?: string[],
  ): Promise<OptimalRate> {
    const blockNumber = await this.dexHelper.web3Provider.eth.getBlockNumber();
    const poolIdentifiers =
      (_poolIdentifiers && { [this.dexKey]: _poolIdentifiers }) ||
      (await this.pricingHelper.getPoolIdentifiers(
        from,
        to,
        side,
        blockNumber,
        [this.dexKey],
      ));

    const amounts = _.range(0, chunks + 1).map(
      i => (amount * BigInt(i)) / BigInt(chunks),
    );
    const poolPrices = await this.pricingHelper.getPoolPrices(
      from,
      to,
      amounts,
      side,
      blockNumber,
      [this.dexKey],
      poolIdentifiers,
    );

    if (!poolPrices || poolPrices.length == 0)
      throw new Error('Fail to get price for ' + this.dexKey);

    const finalPrice = poolPrices[0];
    const quoteAmount = finalPrice.prices[chunks];
    const srcAmount = (
      side === SwapSide.SELL ? amount : quoteAmount
    ).toString();
    const destAmount = (
      side === SwapSide.SELL ? quoteAmount : amount
    ).toString();

    const unoptimizedRate = {
      blockNumber,
      network: this.network,
      srcToken: from.address,
      srcDecimals: from.decimals,
      srcAmount,
      destToken: to.address,
      destDecimals: to.decimals,
      destAmount,
      bestRoute: [
        {
          percent: 100,
          swaps: [
            {
              srcToken: from.address,
              srcDecimals: from.decimals,
              destToken: to.address,
              destDecimals: to.decimals,
              swapExchanges: [
                {
                  exchange: finalPrice.exchange,
                  srcAmount,
                  destAmount,
                  percent: 100,
                  data: finalPrice.data,
                  poolAddresses: finalPrice.poolAddresses,
                },
              ],
            },
          ],
        },
      ],
      gasCostUSD: '0',
      gasCost: '0',
      others: [],
      side,
      tokenTransferProxy: this.dexHelper.config.data.tokenTransferProxyAddress,
      contractAddress: this.dexHelper.config.data.augustusAddress,
    };

    const optimizedRate = this.pricingHelper.optimizeRate(unoptimizedRate);

    return {
      ...optimizedRate,
      hmac: '0',
      srcUSD: '0',
      destUSD: '0',
      contractMethod,
      partnerFee: 0,
    };
  }

  async buildTransaction(
    priceRoute: OptimalRate,
    minMaxAmount: BigInt,
    userAddress: Address,
  ) {
    // Set deadline to be 10 min from now
    let deadline = Number((Math.floor(Date.now() / 1000) + 10 * 60).toFixed());

    const slippageFactor = new BigNumber(minMaxAmount.toString()).div(
      priceRoute.side === SwapSide.SELL
        ? priceRoute.destAmount
        : priceRoute.srcAmount,
    );

    // Call preprocessTransaction for each exchange before we build transaction
    try {
      priceRoute.bestRoute = await Promise.all(
        priceRoute.bestRoute.map(async route => {
          route.swaps = await Promise.all(
            route.swaps.map(async swap => {
              swap.swapExchanges = await Promise.all(
                swap.swapExchanges.map(async exchange => {
                  // Search in dexLib dexes
                  const dexLibExchange = this.pricingHelper.getDexByKey(
                    exchange.exchange,
                  );

                  if (dexLibExchange && dexLibExchange.preProcessTransaction) {
                    if (!dexLibExchange.getTokenFromAddress) {
                      throw new Error(
                        'If you want to test preProcessTransaction, first need to implement getTokenFromAddress function',
                      );
                    }

                    const [preprocessedRoute, txInfo] =
                      await dexLibExchange.preProcessTransaction(
                        exchange,
                        dexLibExchange.getTokenFromAddress(swap.srcToken),
                        dexLibExchange.getTokenFromAddress(swap.destToken),
                        priceRoute.side,
                        {
                          slippageFactor,
                          txOrigin: userAddress,
                        },
                      );

                    deadline =
                      txInfo.deadline && Number(txInfo.deadline) < deadline
                        ? Number(txInfo.deadline)
                        : deadline;

                    return preprocessedRoute;
                  }
                  return exchange;
                }),
              );
              return swap;
            }),
          );
          return route;
        }),
      );
    } catch (e) {
      throw e;
    }

    return await this.transactionBuilder.build({
      priceRoute,
      minMaxAmount: minMaxAmount.toString(),
      userAddress,
      partnerAddress: NULL_ADDRESS,
      partnerFeePercent: '0',
      deadline: deadline.toString(),
      uuid: '00000000-0000-0000-0000-000000000000',
    });
  }
}
