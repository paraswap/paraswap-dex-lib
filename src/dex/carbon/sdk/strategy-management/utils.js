'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                  ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.subtractFee =
  exports.addFee =
  exports.PPM_RESOLUTION =
  exports.createOrders =
  exports.buildStrategyObject =
  exports.parseStrategy =
  exports.decodeStrategy =
  exports.encodeStrategy =
  exports.normalizeInvertedRate =
  exports.normalizeRate =
    void 0;
var numerics_1 = require('../utils/numerics');
var logger_1 = require('../common/logger');
var encoders_1 = require('../utils/encoders');
var utils_1 = require('../utils');
var logger = new logger_1.Logger('utils.ts');
function normalizeRate(amount, amountTokenDecimals, otherTokenDecimals) {
  return new numerics_1.Decimal(amount.toString())
    .times((0, numerics_1.tenPow)(amountTokenDecimals, otherTokenDecimals))
    .toFixed();
}
exports.normalizeRate = normalizeRate;
function normalizeInvertedRate(
  amount,
  amountTokenDecimals,
  otherTokenDecimals,
) {
  if (+amount.toString() === 0) return '0';
  return new numerics_1.Decimal(1)
    .div(amount.toString())
    .times((0, numerics_1.tenPow)(otherTokenDecimals, amountTokenDecimals))
    .toFixed();
}
exports.normalizeInvertedRate = normalizeInvertedRate;
var encodeStrategy = function (strategy) {
  return {
    token0: strategy.token0,
    token1: strategy.token1,
    order0: (0, encoders_1.encodeOrder)(strategy.order0),
    order1: (0, encoders_1.encodeOrder)(strategy.order1),
  };
};
exports.encodeStrategy = encodeStrategy;
var decodeStrategy = function (strategy) {
  return {
    id: strategy.id,
    token0: strategy.token0,
    token1: strategy.token1,
    order0: (0, encoders_1.decodeOrder)(strategy.order0),
    order1: (0, encoders_1.decodeOrder)(strategy.order1),
    encoded: strategy,
  };
};
exports.decodeStrategy = decodeStrategy;
/**
 * Converts a DecodedStrategy object to a Strategy object.
 *
 * @param {DecodedStrategy} strategy - The DecodedStrategy object to convert.
 * @returns {Promise<Strategy>} - A promise that resolves to the Strategy object.
 * @throws {Error} If an error occurs while fetching the decimals for the tokens.
 */
function parseStrategy(strategy, decimals) {
  return __awaiter(this, arguments, void 0, function () {
    var id,
      token0,
      token1,
      order0,
      order1,
      encoded,
      decimals0,
      decimals1,
      buyPriceLow,
      buyPriceHigh,
      sellPriceLow,
      sellPriceHigh,
      sellBudget,
      buyBudget,
      strId,
      strEncoded;
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          logger.debug('parseStrategy called', arguments);
          (id = strategy.id),
            (token0 = strategy.token0),
            (token1 = strategy.token1),
            (order0 = strategy.order0),
            (order1 = strategy.order1),
            (encoded = strategy.encoded);
          return [4 /*yield*/, decimals.fetchDecimals(token0)];
        case 1:
          decimals0 = _a.sent();
          return [4 /*yield*/, decimals.fetchDecimals(token1)];
        case 2:
          decimals1 = _a.sent();
          buyPriceLow = normalizeRate(order1.lowestRate, decimals0, decimals1);
          buyPriceHigh = normalizeRate(
            order1.highestRate,
            decimals0,
            decimals1,
          );
          sellPriceLow = normalizeInvertedRate(
            order0.highestRate,
            decimals1,
            decimals0,
          );
          sellPriceHigh = normalizeInvertedRate(
            order0.lowestRate,
            decimals1,
            decimals0,
          );
          sellBudget = (0, numerics_1.formatUnits)(order0.liquidity, decimals0);
          buyBudget = (0, numerics_1.formatUnits)(order1.liquidity, decimals1);
          strId = id.toString();
          strEncoded = (0, utils_1.encodedStrategyBNToStr)(encoded);
          logger.debug('parseStrategy info:', {
            id: strId,
            token0: token0,
            token1: token1,
            order0: order0,
            order1: order1,
            decimals0: decimals0,
            decimals1: decimals1,
            baseToken: token0,
            quoteToken: token1,
            buyPriceLow: buyPriceLow,
            buyPriceHigh: buyPriceHigh,
            buyBudget: buyBudget,
            sellPriceLow: sellPriceLow,
            sellPriceHigh: sellPriceHigh,
            sellBudget: sellBudget,
            encoded: strEncoded,
          });
          return [
            2 /*return*/,
            {
              id: strId,
              baseToken: token0,
              quoteToken: token1,
              buyPriceLow: buyPriceLow,
              buyPriceHigh: buyPriceHigh,
              buyBudget: buyBudget,
              sellPriceLow: sellPriceLow,
              sellPriceHigh: sellPriceHigh,
              sellBudget: sellBudget,
              encoded: strEncoded,
            },
          ];
      }
    });
  });
}
exports.parseStrategy = parseStrategy;
function buildStrategyObject(
  baseToken,
  quoteToken,
  baseDecimals,
  quoteDecimals,
  buyPriceLow, // in quote tkn per 1 base tkn
  buyPriceHigh, // in quote tkn per 1 base tkn
  buyBudget, // in quote tkn
  sellPriceLow, // in quote tkn per 1 base tkn
  sellPriceHigh, // in quote tkn per 1 base tkn
  sellBudget, // in base tkn
) {
  logger.debug('buildStrategyObject called', arguments);
  if (
    new numerics_1.Decimal(buyPriceLow).isNegative() ||
    new numerics_1.Decimal(buyPriceHigh).isNegative() ||
    new numerics_1.Decimal(sellPriceLow).isNegative() ||
    new numerics_1.Decimal(sellPriceHigh).isNegative()
  ) {
    throw new Error('prices cannot be negative');
  }
  if (
    new numerics_1.Decimal(buyPriceLow).gt(buyPriceHigh) ||
    new numerics_1.Decimal(sellPriceLow).gt(sellPriceHigh)
  ) {
    throw new Error('low price must be lower than or equal to high price');
  }
  if (
    new numerics_1.Decimal(buyBudget).isNegative() ||
    new numerics_1.Decimal(sellBudget).isNegative()
  ) {
    throw new Error('budgets cannot be negative');
  }
  var _a = createOrders(
      baseDecimals,
      quoteDecimals,
      buyPriceLow,
      buyPriceHigh,
      buyBudget,
      sellPriceLow,
      sellPriceHigh,
      sellBudget,
    ),
    order0 = _a.order0,
    order1 = _a.order1;
  logger.debug('buildStrategyObject info:', {
    token0: baseToken,
    token1: quoteToken,
    order0: order0,
    order1: order1,
  });
  return {
    token0: baseToken,
    token1: quoteToken,
    order0: order0,
    order1: order1,
  };
}
exports.buildStrategyObject = buildStrategyObject;
function createOrders(
  baseTokenDecimals,
  quoteTokenDecimals,
  buyPriceLow,
  buyPriceHigh,
  buyBudget,
  sellPriceLow,
  sellPriceHigh,
  sellBudget,
) {
  logger.debug('createOrders called', arguments);
  // order 0 is selling the base token
  // convert base token liquidity (budget) to wei
  var liquidity0 = (0, numerics_1.parseUnits)(sellBudget, baseTokenDecimals);
  /* this order sells base token so the rates are base token per 1 quote token,
    meaning we need to do 1 over - and then low rate is 1/high price.
    Converting to wei in order to factor out different decimals */
  var lowestRate0 = normalizeInvertedRate(
    sellPriceHigh,
    quoteTokenDecimals,
    baseTokenDecimals,
  );
  var highestRate0 = normalizeInvertedRate(
    sellPriceLow,
    quoteTokenDecimals,
    baseTokenDecimals,
  );
  // order 1 is selling the quote token
  // convert quote token liquidity (budget) to wei
  var liquidity1 = (0, numerics_1.parseUnits)(buyBudget, quoteTokenDecimals);
  /* this order sells quote token so the rates are quote token per 1 base token.
    Converting to wei in order to factor out different decimals */
  var lowestRate1 = normalizeRate(
    buyPriceLow,
    quoteTokenDecimals,
    baseTokenDecimals,
  );
  var highestRate1 = normalizeRate(
    buyPriceHigh,
    quoteTokenDecimals,
    baseTokenDecimals,
  );
  var order0 = {
    liquidity: liquidity0.toString(),
    lowestRate: lowestRate0,
    highestRate: highestRate0,
    marginalRate: highestRate0,
  };
  var order1 = {
    liquidity: liquidity1.toString(),
    lowestRate: lowestRate1,
    highestRate: highestRate1,
    marginalRate: highestRate1,
  };
  logger.debug('createOrders info:', { order0: order0, order1: order1 });
  return { order0: order0, order1: order1 };
}
exports.createOrders = createOrders;
exports.PPM_RESOLUTION = 1000000;
function addFee(amount, tradingFeePPM) {
  return new numerics_1.Decimal(amount.toString())
    .mul(exports.PPM_RESOLUTION)
    .div(exports.PPM_RESOLUTION - tradingFeePPM)
    .ceil();
}
exports.addFee = addFee;
function subtractFee(amount, tradingFeePPM) {
  return new numerics_1.Decimal(amount.toString())
    .mul(exports.PPM_RESOLUTION - tradingFeePPM)
    .div(exports.PPM_RESOLUTION)
    .floor();
}
exports.subtractFee = subtractFee;
