import * as _ from 'lodash';
import { DummyDexHelper, IDexHelper } from '../dex-helper';
import { TransactionBuilder } from '../transaction-builder';
import { PricingHelper } from '../pricing-helper';
import { DexAdapterService } from '../dex';
import { Address, Token, OptimalRate, TxObject } from '../types';
import {
  SwapSide,
  AugustusAddress,
  TokenTransferProxyAddress,
  NULL_ADDRESS,
  ContractMethod,
} from '../constants';

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
}

const chunks = 10;

export class LocalParaswapSDK implements IParaSwapSDK {
  dexHelper: IDexHelper;
  dexAdapterService: DexAdapterService;
  pricingHelper: PricingHelper;
  transactionBuilder: TransactionBuilder;

  constructor(protected network: number, protected dexKey: string) {
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
  }

  async initializePricing() {
    const blockNumber = await this.dexHelper.provider.getBlockNumber();
    await this.pricingHelper.initialize(blockNumber, [this.dexKey]);
  }

  async getPrices(
    from: Token,
    to: Token,
    amount: bigint,
    side: SwapSide,
    contractMethod: ContractMethod,
    _poolIdentifiers?: string[],
  ): Promise<OptimalRate> {
    const blockNumber = await this.dexHelper.provider.getBlockNumber();
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
      tokenTransferProxy: TokenTransferProxyAddress[this.network],
      contractAddress: AugustusAddress[this.network],
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
    const deadline = (Math.floor(Date.now() / 1000) + 10 * 60).toFixed();

    return await this.transactionBuilder.build({
      priceRoute,
      minMaxAmount: minMaxAmount.toString(),
      userAddress,
      partnerAddress: NULL_ADDRESS,
      partnerFeePercent: '0',
      deadline,
      uuid: '00000000-0000-0000-0000-000000000000',
    });
  }
}
