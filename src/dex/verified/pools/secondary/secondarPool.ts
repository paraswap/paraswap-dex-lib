import { BasePool } from '../../../balancer-v2/pools/balancer-v2-pool';
import { Interface } from '@ethersproject/abi';
import SECONDARYISSUEPOOL from '../../../../abi/verified/SecondaryIssuePool.json';
import {
  OrdersState,
  PoolPairData,
  PoolState,
  SubgraphPoolBase,
  TokenState,
  VerifiedPoolTypes,
  callData,
} from '../../types';
import { decodeThrowError } from '../../utils';
import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { BigNumber as BigN } from 'bignumber.js';
import { SwapSide } from '@paraswap/core';
import { MathSol } from './secondaryPoolMath';

//Todo: explain the math better(after testing secondary)
export class SecondaryIssuePool {
  vaultAddress: string;
  vaultInterface: Interface;
  poolInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
    this.poolInterface = new Interface(SECONDARYISSUEPOOL.abi);
  }

  //Helper function to parse both primary and secondary issue pools data into params for onSell and onBuy functions.
  parsePoolPairData(
    pool: SubgraphPoolBase,
    poolState: PoolState,
    tokenIn: string,
    tokenOut: string,
  ): PoolPairData {
    let indexIn = 0;
    let indexOut = 0;
    let bptIndex = 0;
    let balances: bigint[] = [];
    let decimals: number[] = [];
    let scalingFactors: bigint[] = [];
    const tokens = poolState.orderedTokens.map((tokenAddress, i) => {
      const t = pool.tokensMap[tokenAddress.toLowerCase()];
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      if (t.address.toLowerCase() === pool.address.toLowerCase()) bptIndex = i;
      balances.push(poolState.tokens[t.address.toLowerCase()].balance);
      const _decimal = pool.tokens[i].decimals;
      decimals.push(_decimal);
      scalingFactors.push(BigInt(10 ** (18 - _decimal)));
      return t.address;
    });
    const orders = pool.orders;
    const secondaryTrades = pool.secondaryTrades;
    const poolPairData: PoolPairData = {
      tokens,
      balances,
      decimals,
      indexIn,
      indexOut,
      bptIndex,
      swapFee: poolState.swapFee,
      minOrderSize: poolState.minimumOrderSize,
      minPrice: poolState.minimumPrice,
      scalingFactors,
      orders,
      secondaryTrades,
    };
    return poolPairData;
  }

  //constructs onchain multicall data for Both Primary and SecondaryIssue Pool.
  //To get pool(primary/secondary) tokens from vault contract, minimum orderSize from primary and secondary,
  //minimumprice from primary
  getOnChainCalls(pool: SubgraphPoolBase, vaultAddress: string): callData[] {
    const poolCallData: callData[] = [
      {
        target: vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          pool.id,
        ]),
      },
    ];
    poolCallData.push({
      target: pool.address,
      callData: this.poolInterface.encodeFunctionData('getMinOrderSize'),
    });

    return poolCallData;
  }

  //Decodes multicall data for both Primary and SecondaryIssue pools. And save pools using address to poolState Mapping.
  //Data must contain returnData. StartIndex is where to start in returnData.
  decodeOnChainCalls(
    pool: SubgraphPoolBase,
    data: { success: boolean; returnData: any }[],
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const pools = {} as { [address: string]: PoolState };
    const poolTokens = decodeThrowError(
      this.vaultInterface,
      'getPoolTokens',
      data[startIndex++],
      pool.address,
    );

    const minimumOrderSize = decodeThrowError(
      this.poolInterface,
      'getMinOrderSize',
      data[startIndex++],
      pool.address,
    )[0];

    const poolState: PoolState = {
      swapFee: BigInt('0'),
      tokens: poolTokens.tokens.reduce(
        (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
          const tokenState: TokenState = {
            balance: BigInt(poolTokens.balances[j].toString()),
          };
          ptAcc[pt.toLowerCase()] = tokenState;
          return ptAcc;
        },
        {},
      ),
      orderedTokens: poolTokens.tokens,
      minimumOrderSize,
    };

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }

  // Helper function that get tokenIn when buying in both primary and secondaery issue pools
  onBuy(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
    creator: string | undefined,
    poolType: VerifiedPoolTypes,
  ): bigint[] {
    return amounts.map(amount =>
      this.getSecondaryTokenIn(poolPairData, amount, creator!, isCurrencyIn),
    );
  }

  //Helper function that get tokenOut when selling in both primary and secondaery issue pools
  onSell(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
    creator: string | undefined,
    poolType: VerifiedPoolTypes,
  ): bigint[] | null {
    return amounts.map(amount =>
      this.getSecondaryTokenOut(poolPairData, amount, creator!, isCurrencyIn),
    );
  }

  _getSecondaryTokenAmount(
    amount: bigint,
    ordersDataScaled: OrdersState[],
    scalingFactor: bigint,
    orderType: string,
  ): bigint {
    let returnAmount = BigInt(0);
    for (let i = 0; i < ordersDataScaled.length; i++) {
      const amountOffered = BigInt(ordersDataScaled[i].amountOffered);
      const priceOffered = BigInt(ordersDataScaled[i].priceOffered);
      const checkValue =
        orderType === 'Sell'
          ? MathSol.divDownFixed(amountOffered, priceOffered)
          : MathSol.mulDownFixed(amountOffered, priceOffered);

      if (checkValue <= Number(amount)) {
        returnAmount = MathSol.add(returnAmount, amountOffered);
      } else {
        returnAmount = MathSol.add(
          returnAmount,
          orderType === 'Sell'
            ? MathSol.mulDownFixed(BigInt(Number(amount)), priceOffered)
            : MathSol.divDownFixed(BigInt(Number(amount)), priceOffered),
        );
      }
      amount = BigInt(Number(amount) - Number(checkValue));
      if (Number(amount) < 0) break;
    }

    returnAmount =
      orderType === 'Sell'
        ? MathSol.divDown(returnAmount, BigInt(Number(scalingFactor)))
        : returnAmount;

    return BigInt(Number(returnAmount));
  }

  //gets amount of tokenOut in Secondary Issue pool(used when selling) according to calculation from SOR Repo
  getSecondaryTokenOut(
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

      const tokensOut = this._getSecondaryTokenAmount(
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
  getSecondaryTokenIn(
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

      const tokensIn = this._getSecondaryTokenAmount(
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

  //TODO: Verify if token decimals are not nedded to get actual balance(depending on the format of amount in)
  //gets maxAmount that can be swapped in or out of both primary and secondary issue pools
  //use 99% of the balance so not all balance can be swapped.
  getSwapMaxAmount(poolPairData: PoolPairData, side: SwapSide): bigint {
    return (
      ((side === SwapSide.SELL
        ? poolPairData.balances[poolPairData.indexIn]
        : poolPairData.balances[poolPairData.indexOut]) *
        99n) /
      100n
    );
  }
}
