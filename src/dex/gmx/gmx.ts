import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  Log,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { GMXData, DexParams } from './types';
import { GMXEventPool } from './pool';
import { SimpleExchange } from '../simple-exchange';
import { GMXConfig, Adapters } from './config';

export class GMX extends SimpleExchange implements IDex<GMXData> {
  protected pool: GMXEventPool | null = null;
  protected supportedTokens: { [address: string]: boolean } = {};

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(GMXConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected params: DexParams = GMXConfig[dexKey][network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    const config = await GMXEventPool.getConfig(
      this.params,
      blockNumber,
      this.dexHelper.multiContract,
    );
    config.tokenAddresses.forEach(
      (token: Address) => (this.supportedTokens[token] = true),
    );
    this.pool = new GMXEventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
      config,
    );
    this.dexHelper.blockManager.subscribeToLogs(
      this.pool,
      this.pool.addressesSubscribed,
      blockNumber,
    );
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY || !this.pool) return [];
    const srcAddress = srcToken.address.toLowerCase();
    const destAddress = destToken.address.toLowerCase();
    if (this.supportedTokens[srcAddress] && this.supportedTokens[destAddress]) {
      return [`${this.dexKey}_${srcAddress}`, `${this.dexKey}_${destAddress}`];
    }
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
  ): Promise<null | ExchangePrices<GMXData>> {
    if (side === SwapSide.BUY || !this.pool) return null;
    const srcAddress = srcToken.address.toLowerCase();
    const destAddress = destToken.address.toLowerCase();
    if (
      !(this.supportedTokens[srcAddress] && this.supportedTokens[destAddress])
    )
      return null;
    const srcPoolIdentifier = `${this.dexKey}_${srcAddress}`;
    const destPoolIdentifier = `${this.dexKey}_${destAddress}`;
    const pools = [srcPoolIdentifier, destPoolIdentifier];
    if (limitPools && pools.some(p => !limitPools.includes(p))) return null;

    const unitVolume = getBigIntPow(srcToken.decimals);
    const prices = await this.pool.getAmountOut(
      srcAddress,
      destAddress,
      [unitVolume, ...amounts],
      blockNumber,
    );

    if (!prices) return null;

    return [
      {
        prices: prices.slice(1),
        unit: prices[0],
        gasCost: 0, // TODO: fix gas cost
        exchange: this.dexKey,
        data: {},
        poolAddresses: [this.params.vault],
      },
    ];
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() couls be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: GMXData,
    side: SwapSide,
  ): AdapterExchangeParam {
    throw new Error('Fix me');
    // TODO: complete me!
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: GMXData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    throw new Error('Fix me');
    // TODO: complete me!
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  updatePoolState(): Promise<void> {
    throw new Error('Fix me');
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    throw new Error('Fix me');
    //TODO: complete me!
  }
}
