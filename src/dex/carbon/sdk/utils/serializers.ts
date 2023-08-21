import { BigNumber } from './numerics';
import {
  EncodedOrder,
  EncodedOrderBNStr,
  EncodedStrategy,
  EncodedStrategyBNStr,
  MatchAction,
  MatchActionBNStr,
  OrdersMap,
  OrdersMapBNStr,
  RetypeBigNumberToString,
  TradeAction,
  TradeActionBNStr,
} from '../common/types';

export const replaceBigNumbersWithStrings = <T>(
  obj: T,
): RetypeBigNumberToString<T> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function replace(obj: any): any {
    if (BigNumber.isBigNumber(obj)) {
      return obj.toString();
    }

    if (typeof obj === 'object' && obj !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newObj: any = Array.isArray(obj) ? [] : {};
      // eslint-disable-next-line no-restricted-syntax
      for (const key in obj) {
        newObj[key] = replace(obj[key]);
      }
      return newObj;
    }

    return obj;
  }

  return replace(obj) as RetypeBigNumberToString<T>;
};

export const encodedOrderBNToStr = (order: EncodedOrder): EncodedOrderBNStr => {
  return replaceBigNumbersWithStrings(order);
};

export const encodedOrderStrToBN = (order: EncodedOrderBNStr): EncodedOrder => {
  return {
    y: BigNumber.from(order.y),
    z: BigNumber.from(order.z),
    A: BigNumber.from(order.A),
    B: BigNumber.from(order.B),
  };
};

export const encodedStrategyBNToStr = (
  strategy: EncodedStrategy,
): EncodedStrategyBNStr => {
  return replaceBigNumbersWithStrings(strategy);
};

export const encodedStrategyStrToBN = (
  strategy: EncodedStrategyBNStr,
): EncodedStrategy => {
  return {
    id: BigNumber.from(strategy.id),
    token0: strategy.token0,
    token1: strategy.token1,
    order0: encodedOrderStrToBN(strategy.order0),
    order1: encodedOrderStrToBN(strategy.order1),
  };
};

export const ordersMapBNToStr = (ordersMap: OrdersMap): OrdersMapBNStr => {
  return replaceBigNumbersWithStrings(ordersMap);
};

export const ordersMapStrToBN = (ordersMap: OrdersMapBNStr): OrdersMap => {
  const deserialized: OrdersMap = {};
  for (const [id, order] of Object.entries(ordersMap)) {
    deserialized[id] = encodedOrderStrToBN(order);
  }
  return deserialized;
};

export const matchActionBNToStr = (action: MatchAction): MatchActionBNStr => {
  return replaceBigNumbersWithStrings(action);
};

export const tradeActionStrToBN = (action: TradeActionBNStr): TradeAction => {
  return {
    strategyId: BigNumber.from(action.strategyId),
    amount: BigNumber.from(action.amount),
  };
};
