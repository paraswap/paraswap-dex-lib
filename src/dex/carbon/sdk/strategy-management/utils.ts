import {
  BigNumber,
  BigNumberish,
  Decimal,
  formatUnits,
  parseUnits,
  tenPow,
} from '../utils/numerics';
import {
  DecodedOrder,
  DecodedStrategy,
  EncodedStrategy,
  Strategy,
} from '../common/types';
import { Logger } from '../common/logger';
import { decodeOrder, encodeOrder } from '../utils/encoders';
import { Decimals } from '../utils/decimals';
import { encodedStrategyBNToStr } from '../utils';

const logger = new Logger('utils.ts');

export function normalizeRate(
  amount: BigNumberish,
  amountTokenDecimals: number,
  otherTokenDecimals: number,
) {
  return new Decimal(amount.toString())
    .times(tenPow(amountTokenDecimals, otherTokenDecimals))
    .toFixed();
}

export function normalizeInvertedRate(
  amount: BigNumberish,
  amountTokenDecimals: number,
  otherTokenDecimals: number,
) {
  if (+amount.toString() === 0) return '0';

  return new Decimal(1)
    .div(amount.toString())
    .times(tenPow(otherTokenDecimals, amountTokenDecimals))
    .toFixed();
}

export const encodeStrategy = (
  strategy: DecodedStrategy,
): Omit<EncodedStrategy, 'id'> => {
  return {
    token0: strategy.token0,
    token1: strategy.token1,
    order0: encodeOrder(strategy.order0),
    order1: encodeOrder(strategy.order1),
  };
};

export const decodeStrategy = (
  strategy: EncodedStrategy,
): DecodedStrategy & { id: BigNumber; encoded: EncodedStrategy } => {
  return {
    id: strategy.id,
    token0: strategy.token0,
    token1: strategy.token1,
    order0: decodeOrder(strategy.order0),
    order1: decodeOrder(strategy.order1),
    encoded: strategy,
  };
};

/**
 * Converts a DecodedStrategy object to a Strategy object.
 *
 * @param {DecodedStrategy} strategy - The DecodedStrategy object to convert.
 * @returns {Promise<Strategy>} - A promise that resolves to the Strategy object.
 * @throws {Error} If an error occurs while fetching the decimals for the tokens.
 */
export async function parseStrategy(
  strategy: DecodedStrategy & { id: BigNumber; encoded: EncodedStrategy },
  decimals: Decimals,
): Promise<Strategy> {
  logger.debug('parseStrategy called', arguments);
  const { id, token0, token1, order0, order1, encoded } = strategy;
  const decimals0 = await decimals.fetchDecimals(token0);
  const decimals1 = await decimals.fetchDecimals(token1);
  const buyPriceLow = normalizeRate(order1.lowestRate, decimals0, decimals1);
  const buyPriceHigh = normalizeRate(order1.highestRate, decimals0, decimals1);
  const sellPriceLow = normalizeInvertedRate(
    order0.highestRate,
    decimals1,
    decimals0,
  );
  const sellPriceHigh = normalizeInvertedRate(
    order0.lowestRate,
    decimals1,
    decimals0,
  );
  const sellBudget = formatUnits(order0.liquidity, decimals0);
  const buyBudget = formatUnits(order1.liquidity, decimals1);

  const strId = id.toString();
  const strEncoded = encodedStrategyBNToStr(encoded);
  logger.debug('parseStrategy info:', {
    id: strId,
    token0,
    token1,
    order0,
    order1,
    decimals0,
    decimals1,
    baseToken: token0,
    quoteToken: token1,
    buyPriceLow,
    buyPriceHigh,
    buyBudget,
    sellPriceLow,
    sellPriceHigh,
    sellBudget,
    encoded: strEncoded,
  });

  return {
    id: strId,
    baseToken: token0,
    quoteToken: token1,
    buyPriceLow,
    buyPriceHigh,
    buyBudget,
    sellPriceLow,
    sellPriceHigh,
    sellBudget,
    encoded: strEncoded,
  };
}

export function buildStrategyObject(
  baseToken: string,
  quoteToken: string,
  baseDecimals: number,
  quoteDecimals: number,
  buyPriceLow: string, // in quote tkn per 1 base tkn
  buyPriceHigh: string, // in quote tkn per 1 base tkn
  buyBudget: string, // in quote tkn
  sellPriceLow: string, // in quote tkn per 1 base tkn
  sellPriceHigh: string, // in quote tkn per 1 base tkn
  sellBudget: string, // in base tkn
): DecodedStrategy {
  logger.debug('buildStrategyObject called', arguments);
  if (
    new Decimal(buyPriceLow).isNegative() ||
    new Decimal(buyPriceHigh).isNegative() ||
    new Decimal(sellPriceLow).isNegative() ||
    new Decimal(sellPriceHigh).isNegative()
  ) {
    throw new Error('prices cannot be negative');
  }
  if (
    new Decimal(buyPriceLow).gt(buyPriceHigh) ||
    new Decimal(sellPriceLow).gt(sellPriceHigh)
  ) {
    throw new Error('low price must be lower than or equal to high price');
  }
  if (
    new Decimal(buyBudget).isNegative() ||
    new Decimal(sellBudget).isNegative()
  ) {
    throw new Error('budgets cannot be negative');
  }

  const { order0, order1 } = createOrders(
    baseDecimals,
    quoteDecimals,
    buyPriceLow,
    buyPriceHigh,
    buyBudget,
    sellPriceLow,
    sellPriceHigh,
    sellBudget,
  );

  logger.debug('buildStrategyObject info:', {
    token0: baseToken,
    token1: quoteToken,
    order0,
    order1,
  });

  return {
    token0: baseToken,
    token1: quoteToken,
    order0,
    order1,
  };
}

export function createOrders(
  baseTokenDecimals: number,
  quoteTokenDecimals: number,
  buyPriceLow: string,
  buyPriceHigh: string,
  buyBudget: string,
  sellPriceLow: string,
  sellPriceHigh: string,
  sellBudget: string,
): { order0: DecodedOrder; order1: DecodedOrder } {
  logger.debug('createOrders called', arguments);
  // order 0 is selling the base token
  // convert base token liquidity (budget) to wei
  const liquidity0 = parseUnits(sellBudget, baseTokenDecimals);

  /* this order sells base token so the rates are base token per 1 quote token,
  meaning we need to do 1 over - and then low rate is 1/high price.
  Converting to wei in order to factor out different decimals */
  const lowestRate0 = normalizeInvertedRate(
    sellPriceHigh,
    quoteTokenDecimals,
    baseTokenDecimals,
  );

  const highestRate0 = normalizeInvertedRate(
    sellPriceLow,
    quoteTokenDecimals,
    baseTokenDecimals,
  );

  // order 1 is selling the quote token
  // convert quote token liquidity (budget) to wei
  const liquidity1 = parseUnits(buyBudget, quoteTokenDecimals);

  /* this order sells quote token so the rates are quote token per 1 base token.
  Converting to wei in order to factor out different decimals */
  const lowestRate1 = normalizeRate(
    buyPriceLow,
    quoteTokenDecimals,
    baseTokenDecimals,
  );
  const highestRate1 = normalizeRate(
    buyPriceHigh,
    quoteTokenDecimals,
    baseTokenDecimals,
  );

  const order0: DecodedOrder = {
    liquidity: liquidity0.toString(),
    lowestRate: lowestRate0,
    highestRate: highestRate0,
    marginalRate: highestRate0,
  };

  const order1: DecodedOrder = {
    liquidity: liquidity1.toString(),
    lowestRate: lowestRate1,
    highestRate: highestRate1,
    marginalRate: highestRate1,
  };
  logger.debug('createOrders info:', { order0, order1 });
  return { order0, order1 };
}

export const PPM_RESOLUTION = 1_000_000;

export function addFee(amount: BigNumberish, tradingFeePPM: number): Decimal {
  return new Decimal(amount.toString())
    .mul(PPM_RESOLUTION)
    .div(PPM_RESOLUTION - tradingFeePPM)
    .ceil();
}

export function subtractFee(
  amount: BigNumberish,
  tradingFeePPM: number,
): Decimal {
  return new Decimal(amount.toString())
    .mul(PPM_RESOLUTION - tradingFeePPM)
    .div(PPM_RESOLUTION)
    .floor();
}
