import {
  validateAndCast,
  tokensResponseValidator,
  pairsResponseValidator,
  pricesResponse,
  blacklistResponseValidator,
  firmRateResponseValidator,
} from './validators';

describe('GenericRFQ Validator test', () => {
  describe('GenericRFQ Tokens Test', () => {
    const tokens = {
      tokens: {
        WETH: {
          symbol: 'WETH',
          name: 'Wrapped Ether',
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          description: 'Canonical wrapped Ether on Ethereum mainnet',
          decimals: 18,
          type: 'ERC20',
        },
        DAI: {
          symbol: 'DAI',
          name: 'Wrapped Ether',
          address: '0x6b175474e89094c44da98b954eedeac495271d0f',
          decimals: 18,
          type: 'ERC20',
        },
      },
    };

    const invalidTokens = {
      tokens: {
        WETH: {
          name: 'Wrapped Ether',
          description: 'Canonical wrapped Ether on Ethereum mainnet',
          decimals: 18,
          type: 'ERC20',
        },
        DAI: {
          symbol: 'DAI',
          name: 'Wrapped Ether',
          address: '0x6b175474e89094c44da98b954eedeac495271d0f',
          description: 'Canonical wrapped Ether on Ethereum mainnet',
          type: 'ERC20',
        },
      },
    };

    it('Token test', () => {
      expect(() =>
        validateAndCast(tokens, tokensResponseValidator),
      ).not.toThrowError();
      expect(() =>
        validateAndCast(invalidTokens, tokensResponseValidator),
      ).toThrowError();
    });
  });

  describe('GenericRFQ Pairs Test', () => {
    const pairs = {
      pairs: {
        'WETH/DAI': {
          base: 'WETH',
          quote: 'DAI',
          liquidityUSD: 468000,
        },
      },
    };

    const invalidPairs = {
      pairs: {
        'WETH/DAI': {
          quote: 'DAI',
          liquidityUSD: 468000,
        },
        'WETH/USDC': {},
      },
    };

    it('Pair test', () => {
      expect(() =>
        validateAndCast(pairs, pairsResponseValidator),
      ).not.toThrowError();
      expect(() =>
        validateAndCast(invalidPairs, pairsResponseValidator),
      ).toThrowError();
    });
  });

  describe('GenericRFQ Prices Test', () => {
    const prices = {
      prices: {
        'WETH/DAI': {
          bids: [
            ['1333.425240000000000000', '1.166200000000000000'],
            ['1333.024812000000000000', '1.166200000000000000'],
            ['1332.624384000000000000', '1.166200000000000000'],
            ['1332.223956000000000000', '1.166200000000000000'],
            ['1331.823528000000000000', '1.166200000000000000'],
            ['1331.423100000000000000', '1.169000000000000000'],
          ],
          asks: [
            ['1336.745410000000000000', '1.166200000000000000'],
            ['1337.146033000000000000', '1.166200000000000000'],
            ['1337.546656000000000000', '1.166200000000000000'],
            ['1337.947279000000000000', '1.166200000000000000'],
            ['1338.347902000000000000', '1.166200000000000000'],
            ['1338.748525000000000000', '1.169000000000000000'],
          ],
        },
      },
    };

    const pricesInvalidBidsNotSortedDesc = {
      prices: {
        'WETH/DAI': {
          bids: [
            ['1333.024812000000000000', '1.166200000000000000'],
            ['1333.425240000000000000', '1.166200000000000000'],
            ['1332.624384000000000000', '1.166200000000000000'],
            ['1332.223956000000000000', '1.166200000000000000'],
            ['1331.823528000000000000', '1.166200000000000000'],
            ['1331.423100000000000000', '1.169000000000000000'],
          ],
          asks: [
            ['1336.745410000000000000', '1.166200000000000000'],
            ['1337.146033000000000000', '1.166200000000000000'],
            ['1337.546656000000000000', '1.166200000000000000'],
            ['1337.947279000000000000', '1.166200000000000000'],
            ['1338.347902000000000000', '1.166200000000000000'],
            ['1338.748525000000000000', '1.169000000000000000'],
          ],
        },
      },
    };

    const pricesInvalidAskNotSortedAsc = {
      prices: {
        'WETH/DAI': {
          bids: [
            ['1333.425240000000000000', '1.166200000000000000'],
            ['1333.024812000000000000', '1.166200000000000000'],
            ['1332.624384000000000000', '1.166200000000000000'],
            ['1332.223956000000000000', '1.166200000000000000'],
            ['1331.823528000000000000', '1.166200000000000000'],
            ['1331.423100000000000000', '1.169000000000000000'],
          ],
          asks: [
            ['1337.146033000000000000', '1.166200000000000000'],
            ['1336.745410000000000000', '1.166200000000000000'],
            ['1337.546656000000000000', '1.166200000000000000'],
            ['1337.947279000000000000', '1.166200000000000000'],
            ['1338.347902000000000000', '1.166200000000000000'],
            ['1338.748525000000000000', '1.169000000000000000'],
          ],
        },
      },
    };

    const noPrices = {
      prices: {
        'WETH/DAI': {},
      },
    };

    const noPricesAtAll = {
      prices: {},
    };

    const onlyBids = {
      prices: {
        'WETH/DAI': {
          bids: [
            ['1333.425240000000000000', '1.166200000000000000'],
            ['1333.024812000000000000', '1.166200000000000000'],
            ['1332.624384000000000000', '1.166200000000000000'],
            ['1332.223956000000000000', '1.166200000000000000'],
            ['1331.823528000000000000', '1.166200000000000000'],
            ['1331.423100000000000000', '1.169000000000000000'],
          ],
        },
      },
    };

    const onlyAsks = {
      prices: {
        'WETH/DAI': {
          asks: [
            ['1336.745410000000000000', '1.166200000000000000'],
            ['1337.146033000000000000', '1.166200000000000000'],
            ['1337.546656000000000000', '1.166200000000000000'],
            ['1337.947279000000000000', '1.166200000000000000'],
            ['1338.347902000000000000', '1.166200000000000000'],
            ['1338.748525000000000000', '1.169000000000000000'],
          ],
        },
      },
    };

    it('Price test', () => {
      expect(() => validateAndCast(prices, pricesResponse)).not.toThrowError();
      expect(() =>
        validateAndCast(pricesInvalidBidsNotSortedDesc, pricesResponse),
      ).toThrowError();
      expect(() =>
        validateAndCast(pricesInvalidAskNotSortedAsc, pricesResponse),
      ).toThrowError();
      expect(() =>
        validateAndCast(noPrices, pricesResponse),
      ).not.toThrowError();
      expect(() =>
        validateAndCast(noPricesAtAll, pricesResponse),
      ).not.toThrowError();
      expect(() =>
        validateAndCast(onlyBids, pricesResponse),
      ).not.toThrowError();
      expect(() =>
        validateAndCast(onlyAsks, pricesResponse),
      ).not.toThrowError();
    });
  });

  describe('GenericRFQ Blacklist Test', () => {
    const blacklist = {
      blacklist: [
        '0x05182E579FDfCf69E4390c3411D8FeA1fb6467cf',
        '0x6dac5CAc7bbCCe4DB3c1Cc5c8FE39DcDdE52A36F',
      ],
    };

    const invalidBlacklist = {
      blacklist: ['aaa', '0xzzac5CAc7bbCCe4DB3c1Cc5c8FE39DcDdE52A36F'],
    };

    it('Blacklist test', () => {
      expect(() =>
        validateAndCast(blacklist, blacklistResponseValidator),
      ).not.toThrowError();
      expect(() =>
        validateAndCast(invalidBlacklist, blacklistResponseValidator),
      ).toThrowError();
    });
  });

  describe('GenericRFQ Order Test', () => {
    const order = {
      order: {
        nonceAndMeta:
          '23584165875646143585237993937352651671727677429752850018718928458402800887759',
        expiry: 1669196734,
        makerAsset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        takerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        makerAmount: '916251430',
        takerAmount: '787729587052171264',
        // 'userAddress': '0x05182E579FDfCf69E4390c3411D8FeA1fb6467cf',
        maker: '0xBB289bC97591F70D8216462DF40ED713011B968a',
        taker: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
        signature:
          '0x6ab2ae5597b140e5fb2a7fc8058a6105c5c508d73d5c78b207213118181d203e7d985af1b2fa05b8efcb0977361eff4168360e8e739d8d23b5b4f749e2544db81c',
      },
    };

    it('Blacklist test', () => {
      expect(() =>
        validateAndCast(order, firmRateResponseValidator),
      ).not.toThrowError();
      // expect(() => validateAndCast(invalidBlacklist, blacklistResponseValidator)).toThrowError();
    });
  });
});
