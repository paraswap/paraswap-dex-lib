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
import { getBigIntPow, getDexKeysWithNetwork, wrapETH } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, WooFiData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { WooFiConfig, Adapters } from './config';
import { wooFiMath } from './woo-fi-math';
import { WOO_FI_GAS_COST } from './ constants';

export class WooFi extends SimpleExchange implements IDex<WooFiData> {
  readonly math: typeof wooFiMath = wooFiMath;

  latestState: PoolState | null = null;

  latestBlockNumber: number = 0;

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(WooFiConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected config = WooFiConfig[dexKey][network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
  }

  get baseTokens(): Token[] {
    return Object.values(this.config.baseTokens);
  }

  get exchangeAddress() {
    return this.config.wooPPAddress;
  }

  get oracleAddress() {
    return this.config.woOracleAddress;
  }

  async fetchStateForBlockNumber(blockNumber: number): Promise<PoolState> {
    return {
      feeRates: {},
      tokenInfos: {},
      tokenStates: {},
    };
  }

  async initializePricing(blockNumber: number) {
    this.latestState = await this.fetchStateForBlockNumber(blockNumber);
    this.latestBlockNumber = blockNumber;
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  static getIdentifier(dexKey: string, baseTokenAddress: string) {
    return `${dexKey.toLowerCase()}_${baseTokenAddress.toLowerCase()}`;
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
  ): Promise<null | ExchangePrices<WooFiData>> {
    try {
      const _srcToken = wrapETH(srcToken, this.network);
      const _destToken = wrapETH(destToken, this.network);

      if (
        _srcToken.address.toLowerCase() === _destToken.address.toLowerCase()
      ) {
        return null;
      }

      // Because all pools are made in the form of: baseToken / quoteToken
      // where quoteToken is always the same, I use only baseToken.
      // Currently on Woo Fi there are only 2 token pools without intersections
      // So we need only to find the second token
      const baseToken =
        limitPools !== undefined
          ? this.baseTokens.filter(t =>
              limitPools.includes(WooFi.getIdentifier(this.dexKey, t.address)),
            )
          : this.baseTokens;

      if (!allowedTokens.length) return null;

      let state: PoolState;
      if (this.latestBlockNumber === blockNumber && this.latestState !== null) {
        state = this.latestState;
      } else {
        this.latestState = await this.fetchStateForBlockNumber(blockNumber);
        this.latestBlockNumber = blockNumber;
        state = this.latestState;
      }

      const unitVolume =
        side === SwapSide.SELL
          ? getBigIntPow(_srcToken.decimals)
          : getBigIntPow(_destToken.decimals);

      const _amounts = [unitVolume, ...amounts.slice(1)];
      const { quoteToken } = this.config;

      const result: ExchangePrices<WooFiData> = [];
      for (const baseToken of allowedTokens) {

        const _prices: bigint[] = [];
        for (const _amount of _amounts) {
          if (_amount === 0n) {
            _prices.push(_amount);
          } else {
            if (
              _srcToken.address.toLowerCase() ===
              quoteToken.address.toLowerCase()
            ) {
              _prices.push(this.math.querySellQuote(state, quoteToken.address, baseToken.address))
            }
          }
        }

        result.push({
          unit,
          prices: [0n, ..._prices.slice(1)],
          data: {
            exchange: this.exchangeAddress,
          },
          poolIdentifier: WooFi.getIdentifier(this.dexKey, token.address),
          exchange: this.dexKey,
          gasCost: WOO_FI_GAS_COST,
          // Is it actually ok if I put here WooPP address?
          poolAddresses: [this.exchangeAddress],
        });
      }
      return result;
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
        }, ${side}:`,
        e,
      );
      return null;
    }
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
    data: WooFiData,
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
    data: WooFiData,
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
