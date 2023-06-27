import {
  EncodedOrder,
  Filter,
  MatchAction,
  MatchOptions,
  MatchType,
  OrdersMap,
  Quote,
  Rate,
} from '../common/types';
import { decodeFloat } from '../utils/encoders';
import { BigNumber, BigNumberMin } from '../utils/numerics';
import {
  getEncodedTradeTargetAmount as tradeTargetAmount,
  getEncodedTradeSourceAmount as tradeSourceAmount,
} from './trade';
import { sortByMaxRate, sortByMinRate } from './utils';

const rateBySourceAmount = (
  sourceAmount: BigNumber,
  order: EncodedOrder,
): Rate => {
  let input = sourceAmount;
  let output = tradeTargetAmount(input, order);
  if (output.gt(order.y)) {
    input = tradeSourceAmount(order.y, order);
    output = tradeTargetAmount(input, order);
    while (output.gt(order.y)) {
      input = input.sub(1);
      output = tradeTargetAmount(input, order);
    }
  }
  return { input, output };
};

const rateByTargetAmount = (
  targetAmount: BigNumber,
  order: EncodedOrder,
): Rate => {
  const input = BigNumberMin(targetAmount, order.y);
  const output = tradeSourceAmount(input, order);
  return { input, output };
};

const getParams = (order: EncodedOrder) => {
  const [y, z, A, B] = [order.y, order.z, order.A, order.B];
  return [y, z, decodeFloat(A), decodeFloat(B)];
};

const getLimit = (order: EncodedOrder) => {
  const [y, z, A, B] = getParams(order);
  return z.gt(0) ? y.mul(A).add(z.mul(B)).div(z) : BigNumber.from(0);
};

const equalTargetAmount = (order: EncodedOrder, limit: BigNumber) => {
  const [y, z, A, B] = getParams(order);
  return A.gt(0)
    ? y
        .mul(A)
        .add(z.mul(B.sub(limit)))
        .div(A)
    : y;
};

const equalSourceAmount = (order: EncodedOrder, limit: BigNumber) => {
  return tradeSourceAmount(equalTargetAmount(order, limit), order);
};

/**
 * Sort the orders from best rate to worst rate:
 * - Compute the rate of an order:
 *   - Let `x` denote the maximum tradable amount not larger than `n`
 *   - Let `y` denote the output amount of trading `x`
 *   - The rate is determined as `y / x`
 * - Compute the rates of two orders:
 *   - If the rates are different, then the one with a better value prevails
 *   - If the rates are identical, then the one with a better value of `y` prevails
 */
const sortedQuotes = (
  amount: BigNumber,
  ordersMap: OrdersMap,
  trade: (amount: BigNumber, order: EncodedOrder) => Rate,
  sort: (x: Rate, y: Rate) => number,
): Quote[] =>
  Object.keys(ordersMap)
    .map(id => ({
      id: BigNumber.from(id),
      rate: trade(amount, ordersMap[id]),
    }))
    .sort((a, b) => sort(a.rate, b.rate));

/**
 * Compute a list of {order id, trade amount} tuples:
 * - Let `n` denote the initial input amount
 * - Iterate the orders from best rate to worst rate:
 *   - Let `m` denote the maximum tradable amount not larger than `n`
 *   - Add the id of the order along with `m` to the output matching
 *   - If `m < n` then subtract `m` from `n` and continue, otherwise break
 */
const matchFast = (
  amount: BigNumber,
  ordersMap: OrdersMap,
  quotes: Quote[],
  filter: Filter,
  trade: (amount: BigNumber, order: EncodedOrder) => Rate,
): MatchAction[] => {
  const actions: MatchAction[] = [];

  for (const quote of quotes) {
    if (amount.gt(quote.rate.input)) {
      if (filter(quote.rate)) {
        actions.push({
          id: quote.id,
          input: quote.rate.input,
          output: quote.rate.output,
        });
        amount = amount.sub(quote.rate.input);
      }
    } else if (amount.eq(quote.rate.input)) {
      if (filter(quote.rate)) {
        actions.push({
          id: quote.id,
          input: quote.rate.input,
          output: quote.rate.output,
        });
      }
      break;
    } /* if (amount.lt(rate.input)) */ else {
      const adjustedRate: Rate = {
        input: amount,
        output: trade(amount, ordersMap[quote.id.toString()]).output,
      };
      if (filter(adjustedRate)) {
        actions.push({
          id: quote.id,
          input: adjustedRate.input,
          output: adjustedRate.output,
        });
      }
      break;
    }
  }

  return actions;
};

/**
 * Compute a list of {order id, trade amount} tuples:
 * - Iterate the orders from best rate to worst rate:
 *   - Calculate a trade which brings orders `0` thru `n - 1` to the rate of order `n`
 *   - If the result is larger than or equal to the requested trade amount, then stop
 * - If the result is larger than the requested trade amount:
 *   - Determine a rate `r` between the rate of order `n - 1` and the rate of order `n`
 *   - Calculate a trade which brings orders `0` thru `n - 1` to the rate `r`
 *   - If the result is equal to the requested trade amount, then stop
 */
const matchBest = (
  amount: BigNumber,
  ordersMap: OrdersMap,
  quotes: Quote[],
  filter: Filter,
  trade: (amount: BigNumber, order: EncodedOrder) => Rate,
  equalize: (order: EncodedOrder, limit: BigNumber) => BigNumber,
): MatchAction[] => {
  const order0: EncodedOrder = {
    y: BigNumber.from(0),
    z: BigNumber.from(0),
    A: BigNumber.from(0),
    B: BigNumber.from(0),
  };
  const orders = quotes
    .map(quote => ordersMap[quote.id.toString()])
    .concat(order0);

  let rates: Rate[] = [];
  let limit = BigNumber.from(0);
  let total = BigNumber.from(0);
  let delta = BigNumber.from(0);

  for (let n = 1; n < orders.length; n++) {
    limit = getLimit(orders[n]);
    rates = orders
      .slice(0, n)
      .map(order => trade(equalize(order, limit), order));
    total = rates.reduce((sum, rate) => sum.add(rate.input), BigNumber.from(0));
    delta = total.sub(amount);
    if (delta.eq(0)) {
      break;
    }
    if (delta.gt(0)) {
      let lo = limit;
      let hi = getLimit(orders[n - 1]);
      while (lo.add(1).lt(hi)) {
        limit = lo.add(hi).div(2);
        rates = orders
          .slice(0, n)
          .map(order => trade(equalize(order, limit), order));
        total = rates.reduce(
          (sum, rate) => sum.add(rate.input),
          BigNumber.from(0),
        );
        delta = total.sub(amount);
        if (delta.gt(0)) {
          lo = limit;
        } else if (delta.lt(0)) {
          hi = limit;
        } /* if (delta.eq(0)) */ else {
          break;
        }
      }
      break;
    }
  }

  if (delta.gt(0)) {
    for (let i = rates.length - 1; i >= 0; i--) {
      const rate = trade(rates[i].input.sub(delta), orders[i]);
      delta = delta.add(rate.input.sub(rates[i].input));
      rates[i] = rate;
      if (delta.lte(0)) {
        break;
      }
    }
  } else if (delta.lt(0)) {
    for (let i = 0; i <= rates.length - 1; i++) {
      const rate = trade(rates[i].input.sub(delta), orders[i]);
      delta = delta.add(rate.input.sub(rates[i].input));
      if (delta.gt(0)) {
        break;
      }
      rates[i] = rate;
    }
  }

  return [...Array(rates.length).keys()]
    .filter(i => filter(rates[i]))
    .map(i => ({
      id: quotes[i].id,
      input: rates[i].input,
      output: rates[i].output,
    }));
};

const matchBy = (
  amount: BigNumber,
  ordersMap: OrdersMap,
  matchTypes: MatchType[],
  filter: Filter,
  trade: (amount: BigNumber, order: EncodedOrder) => Rate,
  sort: (x: Rate, y: Rate) => number,
  equalize: (order: EncodedOrder, limit: BigNumber) => BigNumber,
): MatchOptions => {
  const quotes = sortedQuotes(amount, ordersMap, trade, sort);
  const res: MatchOptions = {};
  if (matchTypes.includes(MatchType.Fast)) {
    res[MatchType.Fast] = matchFast(amount, ordersMap, quotes, filter, trade);
  }
  if (matchTypes.includes(MatchType.Best)) {
    res[MatchType.Best] = matchBest(
      amount,
      ordersMap,
      quotes,
      filter,
      trade,
      equalize,
    );
  }
  return res;
};

const defaultFilter: Filter = (rate: Rate) =>
  rate.input.gt(0) && rate.output.gt(0);

export const matchBySourceAmount = (
  amount: BigNumber,
  ordersMap: OrdersMap,
  matchTypes: MatchType[],
  filter: Filter = defaultFilter,
): MatchOptions => {
  return matchBy(
    amount,
    ordersMap,
    matchTypes,
    filter,
    rateBySourceAmount,
    sortByMinRate,
    equalSourceAmount,
  );
};

export const matchByTargetAmount = (
  amount: BigNumber,
  ordersMap: OrdersMap,
  matchTypes: MatchType[],
  filter: Filter = defaultFilter,
): MatchOptions => {
  return matchBy(
    amount,
    ordersMap,
    matchTypes,
    filter,
    rateByTargetAmount,
    sortByMaxRate,
    equalTargetAmount,
  );
};
