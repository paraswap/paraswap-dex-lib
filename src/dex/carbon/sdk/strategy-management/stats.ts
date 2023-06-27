import { Decimal } from '../utils/numerics';
import { DecodedOrder } from '../common/types';

export function getMinRate(orders: DecodedOrder[]): Decimal {
  return orders.reduce(
    (rate, order) => Decimal.min(rate, order.lowestRate),
    new Decimal(+Infinity),
  );
}

export function getMaxRate(orders: DecodedOrder[]): Decimal {
  return orders.reduce(
    (rate, order) => Decimal.max(rate, order.marginalRate),
    new Decimal(-Infinity),
  );
}

type ProcessedOrder = {
  liq: Decimal;
  min: Decimal;
  mid: Decimal;
  midMinusMin: Decimal;
};

export function getDepths(orders: DecodedOrder[], rates: Decimal[]): Decimal[] {
  const processedOrders: ProcessedOrder[] = orders.map(order => {
    const min = new Decimal(order.lowestRate).sqrt();
    const mid = new Decimal(order.marginalRate).sqrt();
    return {
      liq: new Decimal(order.liquidity),
      min,
      mid,
      midMinusMin: mid.sub(min),
    };
  });

  return rates.map(rate => {
    const rateRoot = rate.sqrt();
    return processedOrders.reduce(
      (sum, order) => sum.add(getAmount(order, rateRoot)),
      new Decimal(0),
    );
  });
}

/**
 * Given an order with:
 * - liquidity: the liquidity of the order
 * - lowestRate: the most expensive rate at which the order will sell its liquidity
 * - marginalRate: the rate at which the order is currently selling its liquidity
 * If a given rate is:
 * - more expensive (lower) than lowestRate: all of the liquidity can be bought at this rate
 * - less expensive (higher) than marginalRate: none of the liquidity can be bought at this rate
 * - in between lowestRate and marginalRate: some of the liquidity can be bought at this rate
 * @param {ProcessedOrder} order
 * @param {Decimal} rateRoot - the square root of the rate
 * @returns {Decimal} the amount of liquidity that can be bought without paying more than the given rate
 */
function getAmount(order: ProcessedOrder, rateRoot: Decimal): Decimal {
  // rate <= lowestRate - all of the liquidity can be bought at this rate
  if (rateRoot.lte(order.min)) {
    return order.liq;
  }

  // rate >= marginalRate - none of the liquidity can be bought at this rate
  if (rateRoot.gte(order.mid)) {
    return new Decimal(0);
  }

  // lowestRate < rate < marginalRate
  return order.liq.sub(
    order.liq.mul(rateRoot.sub(order.min)).div(order.midMinusMin),
  );
}
