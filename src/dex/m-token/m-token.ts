import { AsyncOrSync } from 'ts-essentials';
import type {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  Logger,
  PoolLiquidity,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import type { MTokenData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';

export class MToken extends SimpleExchange implements IDex<MTokenData> {
  readonly hasConstantPriceLargeAmounts = true;

  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly config: DexParams,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
  }

  // No initialization needed for constant price
  async initializePricing() {}

  // Legacy: was only used for V5
  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters() {
    return null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const isValid =
      from?.address?.toLowerCase() ===
        this.config.fromToken.address.toLowerCase() &&
      to?.address?.toLowerCase() === this.config.toToken.address.toLowerCase();

    if (!isValid) {
      return [];
    }

    return [`${this.dexKey}_${this.config.toToken.address}`];
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
  ): Promise<null | ExchangePrices<MTokenData>> {
    // TODO: complete me!
    return [];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<MTokenData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: MTokenData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const exchange = '0x';

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

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
    // TODO: complete me!
    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
