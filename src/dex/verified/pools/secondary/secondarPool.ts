import { BasePool } from '../../../balancer-v2/pools/balancer-v2-pool';
import { Interface } from '@ethersproject/abi';
import SECONDARYISSUEPOOL from '../../../../abi/verified/SecondaryIssuePool.json';
import { OrdersState, PoolPairData } from '../../types';
import { _getSecondaryTokenAmount } from '../../utils';
import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { BigNumber as BigN } from 'bignumber.js';

//gets amount of tokenOut in Secondary Issue pool(used when selling) according to calculation from SOR Repo
export function getSecondaryTokenOut(
  poolPairData: PoolPairData,
  amount: bigint,
  creator: string,
  isCurrencyIn: boolean,
): bigint {
  try {
    if (amount == 0n) return 0n;
    let security: string;
    let scalingFactor: bigint;
    if (isCurrencyIn) {
      security = poolPairData.tokens[poolPairData.indexOut];
      scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
    } else {
      security = poolPairData.tokens[poolPairData.indexIn];
      scalingFactor = poolPairData.scalingFactors[poolPairData.indexOut];
    }
    let buyOrders = poolPairData
      .orders!.filter(
        order =>
          order.tokenIn.id.toLowerCase() !== security.toLowerCase() &&
          order.creator.toLowerCase() !== creator.toLowerCase(),
      )
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    // filtering of edited & cancelled order from orderBook
    let openOrders: OrdersState[] = Object.values(
      buyOrders.reduce((acc: any, cur) => {
        if (!acc[cur.orderReference]) {
          // If this is the first time we've seen this orderReference, add it to the accumulator
          acc[cur.orderReference] = cur;
        }
        return acc;
      }, {}),
    );
    openOrders = openOrders.filter(order => order.priceOffered !== 0);
    if (poolPairData.secondaryTrades?.length) {
      buyOrders = openOrders
        .map(order => {
          // filtering of already matched orders
          const matchedTrade = poolPairData.secondaryTrades?.find(
            trade =>
              trade.orderReference?.toLowerCase() ===
              order.orderReference?.toLowerCase(),
          );
          if (matchedTrade) {
            const price =
              order.tokenIn.id.toLowerCase() === security.toLowerCase()
                ? (1 / matchedTrade.price) * 10 ** 18
                : matchedTrade.price / 10 ** 18;
            const amount = matchedTrade.amount * price;
            return {
              ...order,
              amountOffered: order.amountOffered - amount,
            };
          }
          return order;
        })
        .filter(element => element && element.amountOffered !== 0);
    }
    buyOrders = buyOrders.sort((a, b) => b.priceOffered - a.priceOffered);

    const orderBookdepth = BigInt(
      buyOrders
        .map(
          order =>
            (order.amountOffered / order.priceOffered) *
            Number(BigNumber.from('1000000000000000000')),
        )
        .reduce((partialSum, a) => Number(BigN(partialSum).plus(BigN(a))), 0),
    );
    if (Number(amount) > Number(orderBookdepth)) return 0n;

    const tokensOut = _getSecondaryTokenAmount(
      amount,
      buyOrders,
      scalingFactor!,
      'Sell',
    );

    const scaleTokensOut = formatFixed(
      BigNumber.from(Math.trunc(Number(tokensOut.toString())).toString()),
      poolPairData.decimals[poolPairData.indexOut],
    );
    return BigInt(scaleTokensOut);
  } catch (err: any) {
    return 0n;
  }
}
//gets amount of tokenIn in Secondary Issue pool(used when buying) according to calculation from SOR Repo
export function getSecondaryTokenIn(
  poolPairData: PoolPairData,
  amount: bigint,
  creator: string,
  isCurrencyIn: boolean,
): bigint {
  try {
    let currency: string;
    let security: string;
    let scalingFactor: bigint;
    if (isCurrencyIn) {
      currency = poolPairData.tokens[poolPairData.indexIn];
      security = poolPairData.tokens[poolPairData.indexOut];
      scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
    } else {
      currency = poolPairData.tokens[poolPairData.indexOut];
      security = poolPairData.tokens[poolPairData.indexIn];
      scalingFactor = poolPairData.scalingFactors[poolPairData.indexOut];
    }
    const scaledAmount = amount * scalingFactor!;
    if (scaledAmount === 0n) return 0n;
    let sellOrders = poolPairData
      .orders!.filter(
        order =>
          order.tokenIn.id.toLowerCase() !== currency.toLowerCase() &&
          order.creator.toLowerCase() !== creator.toLowerCase(),
      )
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    // filtering of edited & cancelled order from orderBook
    let openOrders: OrdersState[] = Object.values(
      sellOrders.reduce((acc: any, cur) => {
        if (!acc[cur.orderReference]) {
          // If this is the first time we've seen this orderReference, add it to the accumulator
          acc[cur.orderReference] = cur;
        }
        return acc;
      }, {}),
    );

    openOrders = openOrders.filter(order => order.priceOffered !== 0);

    if (poolPairData.secondaryTrades!.length) {
      sellOrders = openOrders
        .map(order => {
          // filtering of already matched orders
          const matchedTrade = poolPairData.secondaryTrades!.find(
            trade =>
              trade.orderReference?.toLowerCase() ===
              order.orderReference?.toLowerCase(),
          );
          if (matchedTrade) {
            const price =
              order.tokenIn.id.toLowerCase() === security.toLowerCase()
                ? (1 / Number(matchedTrade.price)) * 10 ** 18
                : Number(matchedTrade.price) / 10 ** 18;
            const amount = Number(matchedTrade.amount) * price;
            return {
              ...order,
              amountOffered: order.amountOffered - amount,
            };
          }
          return order;
        })
        .filter(element => element && Number(element.amountOffered) !== 0);
    }
    sellOrders = sellOrders.sort((a, b) => a.priceOffered - b.priceOffered);
    const orderBookdepth = BigInt(
      sellOrders
        .map(
          order =>
            (order.amountOffered * order.priceOffered) /
            Number(BigNumber.from('1000000000000000000')),
        )
        .reduce((partialSum, a) => Number(BigN(partialSum).plus(BigN(a))), 0),
    );

    if (Number(amount) > Number(orderBookdepth)) return 0n;

    const tokensIn = _getSecondaryTokenAmount(
      amount,
      sellOrders,
      scalingFactor,
      'Buy',
    );

    const scaleTokensOut = formatFixed(
      BigNumber.from(Math.trunc(Number(tokensIn.toString())).toString()),
      poolPairData.decimals[poolPairData.indexOut],
    );
    return BigInt(scaleTokensOut);
  } catch (err: any) {
    return 0n;
  }
}
