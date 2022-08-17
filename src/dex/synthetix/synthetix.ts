import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { OnchainConfigValues, SynthetixData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { SynthetixConfig, Adapters } from './config';
import { SynthetixEventPool } from './synthetix-pool';

export class Synthetix extends SimpleExchange implements IDex<SynthetixData> {
  protected eventPools: SynthetixEventPool;

  readonly hasConstantPriceLargeAmounts = false;

  onchainConfigValues?: OnchainConfigValues;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SynthetixConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected config = SynthetixConfig[dexKey][network],
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new SynthetixEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
  }

  async initializePricing(blockNumber: number) {
    this.onchainConfigValues = await this.getOnchainConfigValues(blockNumber);
  }

  async getOnchainConfigValues(
    blockNumber?: number,
  ): Promise<OnchainConfigValues> {
    const calldata = [];

    return {
      lastUpdatedInMs: Date.now(),

      addressToToken: {},
      atomicExchangeFeeRate: {},
      exchangeFeeRate: {},
      pureChainlinkPriceForAtomicSwapsEnabled: {},
      atomicEquivalentForDexPricing: {},
      atomicTwapWindow: 0n,

      dexPriceAggregator: {
        weth: '',
        defaultPoolFee: 0n,
        uniswapV3Factory: '',
        overriddenPoolForRoute: {},
      },
    };
  }

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
    // TODO: complete me!
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
  ): Promise<null | ExchangePrices<SynthetixData>> {
    // TODO: complete me!
    return null;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SynthetixData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
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
    data: SynthetixData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the transaction arguments
    const swapData = '';

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
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
    //TODO: complete me!
    return [];
  }
}
