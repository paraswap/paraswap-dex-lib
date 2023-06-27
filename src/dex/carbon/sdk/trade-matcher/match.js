'use strict';
var __spreadArray =
  (this && this.__spreadArray) ||
  function (to, from, pack) {
    if (pack || arguments.length === 2)
      for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.matchByTargetAmount = exports.matchBySourceAmount = void 0;
var types_1 = require('../common/types');
var encoders_1 = require('../utils/encoders');
var numerics_1 = require('../utils/numerics');
var trade_1 = require('./trade');
var utils_1 = require('./utils');
var rateBySourceAmount = function (sourceAmount, order) {
  var input = sourceAmount;
  var output = (0, trade_1.getEncodedTradeTargetAmount)(input, order);
  if (output.gt(order.y)) {
    input = (0, trade_1.getEncodedTradeSourceAmount)(order.y, order);
    output = (0, trade_1.getEncodedTradeTargetAmount)(input, order);
    while (output.gt(order.y)) {
      input = input.sub(1);
      output = (0, trade_1.getEncodedTradeTargetAmount)(input, order);
    }
  }
  return { input: input, output: output };
};
var rateByTargetAmount = function (targetAmount, order) {
  var input = (0, numerics_1.BigNumberMin)(targetAmount, order.y);
  var output = (0, trade_1.getEncodedTradeSourceAmount)(input, order);
  return { input: input, output: output };
};
var getParams = function (order) {
  var _a = [order.y, order.z, order.A, order.B],
    y = _a[0],
    z = _a[1],
    A = _a[2],
    B = _a[3];
  return [y, z, (0, encoders_1.decodeFloat)(A), (0, encoders_1.decodeFloat)(B)];
};
var getLimit = function (order) {
  var _a = getParams(order),
    y = _a[0],
    z = _a[1],
    A = _a[2],
    B = _a[3];
  return z.gt(0) ? y.mul(A).add(z.mul(B)).div(z) : numerics_1.BigNumber.from(0);
};
var equalTargetAmount = function (order, limit) {
  var _a = getParams(order),
    y = _a[0],
    z = _a[1],
    A = _a[2],
    B = _a[3];
  return A.gt(0)
    ? y
        .mul(A)
        .add(z.mul(B.sub(limit)))
        .div(A)
    : y;
};
var equalSourceAmount = function (order, limit) {
  return (0, trade_1.getEncodedTradeSourceAmount)(
    equalTargetAmount(order, limit),
    order,
  );
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
var sortedQuotes = function (amount, ordersMap, trade, sort) {
  return Object.keys(ordersMap)
    .map(function (id) {
      return {
        id: numerics_1.BigNumber.from(id),
        rate: trade(amount, ordersMap[id]),
      };
    })
    .sort(function (a, b) {
      return sort(a.rate, b.rate);
    });
};
/**
 * Compute a list of {order id, trade amount} tuples:
 * - Let `n` denote the initial input amount
 * - Iterate the orders from best rate to worst rate:
 *   - Let `m` denote the maximum tradable amount not larger than `n`
 *   - Add the id of the order along with `m` to the output matching
 *   - If `m < n` then subtract `m` from `n` and continue, otherwise break
 */
var matchFast = function (amount, ordersMap, quotes, filter, trade) {
  var actions = [];
  for (var _i = 0, quotes_1 = quotes; _i < quotes_1.length; _i++) {
    var quote = quotes_1[_i];
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
      var adjustedRate = {
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
var matchBest = function (amount, ordersMap, quotes, filter, trade, equalize) {
  var order0 = {
    y: numerics_1.BigNumber.from(0),
    z: numerics_1.BigNumber.from(0),
    A: numerics_1.BigNumber.from(0),
    B: numerics_1.BigNumber.from(0),
  };
  var orders = quotes
    .map(function (quote) {
      return ordersMap[quote.id.toString()];
    })
    .concat(order0);
  var rates = [];
  var limit = numerics_1.BigNumber.from(0);
  var total = numerics_1.BigNumber.from(0);
  var delta = numerics_1.BigNumber.from(0);
  for (var n = 1; n < orders.length; n++) {
    limit = getLimit(orders[n]);
    rates = orders.slice(0, n).map(function (order) {
      return trade(equalize(order, limit), order);
    });
    total = rates.reduce(function (sum, rate) {
      return sum.add(rate.input);
    }, numerics_1.BigNumber.from(0));
    delta = total.sub(amount);
    if (delta.eq(0)) {
      break;
    }
    if (delta.gt(0)) {
      var lo = limit;
      var hi = getLimit(orders[n - 1]);
      while (lo.add(1).lt(hi)) {
        limit = lo.add(hi).div(2);
        rates = orders.slice(0, n).map(function (order) {
          return trade(equalize(order, limit), order);
        });
        total = rates.reduce(function (sum, rate) {
          return sum.add(rate.input);
        }, numerics_1.BigNumber.from(0));
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
    for (var i = rates.length - 1; i >= 0; i--) {
      var rate = trade(rates[i].input.sub(delta), orders[i]);
      delta = delta.add(rate.input.sub(rates[i].input));
      rates[i] = rate;
      if (delta.lte(0)) {
        break;
      }
    }
  } else if (delta.lt(0)) {
    for (var i = 0; i <= rates.length - 1; i++) {
      var rate = trade(rates[i].input.sub(delta), orders[i]);
      delta = delta.add(rate.input.sub(rates[i].input));
      if (delta.gt(0)) {
        break;
      }
      rates[i] = rate;
    }
  }
  return __spreadArray([], Array(rates.length).keys(), true)
    .filter(function (i) {
      return filter(rates[i]);
    })
    .map(function (i) {
      return {
        id: quotes[i].id,
        input: rates[i].input,
        output: rates[i].output,
      };
    });
};
var matchBy = function (
  amount,
  ordersMap,
  matchTypes,
  filter,
  trade,
  sort,
  equalize,
) {
  var quotes = sortedQuotes(amount, ordersMap, trade, sort);
  var res = {};
  if (matchTypes.includes(types_1.MatchType.Fast)) {
    res[types_1.MatchType.Fast] = matchFast(
      amount,
      ordersMap,
      quotes,
      filter,
      trade,
    );
  }
  if (matchTypes.includes(types_1.MatchType.Best)) {
    res[types_1.MatchType.Best] = matchBest(
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
var defaultFilter = function (rate) {
  return rate.input.gt(0) && rate.output.gt(0);
};
var matchBySourceAmount = function (amount, ordersMap, matchTypes, filter) {
  if (filter === void 0) {
    filter = defaultFilter;
  }
  return matchBy(
    amount,
    ordersMap,
    matchTypes,
    filter,
    rateBySourceAmount,
    utils_1.sortByMinRate,
    equalSourceAmount,
  );
};
exports.matchBySourceAmount = matchBySourceAmount;
var matchByTargetAmount = function (amount, ordersMap, matchTypes, filter) {
  if (filter === void 0) {
    filter = defaultFilter;
  }
  return matchBy(
    amount,
    ordersMap,
    matchTypes,
    filter,
    rateByTargetAmount,
    utils_1.sortByMaxRate,
    equalTargetAmount,
  );
};
exports.matchByTargetAmount = matchByTargetAmount;
