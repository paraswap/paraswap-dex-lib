import { Token } from '../../types';
import { bigIntify } from '../../utils';
import { BI_POWS } from '../../bigint-constants';
import { IRequestWrapper } from '../../dex-helper';

export class LighterPriceOracle {
  cache = new Map<
    String,
    {
      created: number;
      price: number;
    }
  >();

  constructor(
    readonly httpRequest: IRequestWrapper,
    readonly ttlMs: number = 5000,
  ) {}

  getTokenPriceFromCache(tokenSymbol: string): number | null {
    const cached = this.cache.get(tokenSymbol);
    const now = new Date().getTime();
    if (cached && cached.created + this.ttlMs > now) {
      return cached.price;
    }
    return null;
  }

  setTokenPriceInCache(tokenSymbol: string, price: number) {
    this.cache.set(tokenSymbol, {
      created: new Date().getTime(),
      price: price,
    });
  }

  getBinanceSymbol(tokenSymbol: string): string {
    const validSymbols = ['USDC', 'USDT', 'DAI'];
    if (validSymbols.includes(tokenSymbol)) return tokenSymbol;

    // remove first W in care of wrapped tokens
    const wrappedTokens = ['WBTC', 'WETH', 'WMATIC'];
    if (wrappedTokens.includes(tokenSymbol)) return tokenSymbol.slice(1);

    if (tokenSymbol === 'USDC.e') return 'USDC';

    return tokenSymbol;
  }

  // returns the price of the token in USDT, using binance prices
  async getTokenPrice(tokenSymbol?: string): Promise<number> {
    if (!tokenSymbol) {
      return 0;
    }

    // try to get from cache
    const cached = this.getTokenPriceFromCache(tokenSymbol);
    if (cached != null) {
      return cached;
    }

    if (tokenSymbol == 'USDT') {
      return 1;
    }

    tokenSymbol = this.getBinanceSymbol(tokenSymbol);
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tokenSymbol}USDT`;

    let response: any;
    try {
      response = await this.httpRequest.get(url);
      const price = parseFloat(response.price);
      this.setTokenPriceInCache(tokenSymbol, price);
      return price;
    } catch (e) {
      return 0;
    }
  }

  // returns the value of the token, in USDT
  async getTokenValue(token: Token, amount: bigint): Promise<number> {
    const price = await this.getTokenPrice(token.symbol);
    const precision = 10000000;
    return Number(
      (amount * bigIntify(price * precision)) /
        bigIntify(precision) /
        BI_POWS[token.decimals],
    );
  }
}
