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
    return await this.pricingHelper.initialize(blockNumber, [this.dexKey]);
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
      _poolIdentifiers ||
      (
        await this.pricingHelper.getPoolIdentifiers(
          from,
          to,
          side,
          blockNumber,
          [this.dexKey],
        )
      )[0];
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
      { [this.dexKey]: poolIdentifiers },
    );
    const finalPrice = poolPrices[0];
    const quoteAmount = finalPrice.prices[chunks];
    const srcAmount = (
      side === SwapSide.SELL ? amount : quoteAmount
    ).toString();
    const destAmount = (
      side === SwapSide.SELL ? quoteAmount : amount
    ).toString();

    return {
      blockNumber,
      network: this.network,
      srcToken: from.address,
      srcDecimals: from.decimals,
      srcAmount,
      srcUSD: '0',
      destToken: to.address,
      destDecimals: to.decimals,
      destAmount,
      destUSD: '0',
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
      contractMethod,
      tokenTransferProxy: TokenTransferProxyAddress[this.network],
      contractAddress: AugustusAddress[this.network],
      partnerFee: 0,
      hmac: '0',
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
