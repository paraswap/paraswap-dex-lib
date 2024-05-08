import { Interface } from '@ethersproject/abi';
import SECONDARYISSUEPOOL from '../../../../abi/verified/SecondaryIssuePool.json';
import {
  OrdersState,
  PoolPairData,
  PoolState,
  SubgraphPoolBase,
  TokenState,
  callData,
} from '../../types';
import { decodeThrowError } from '../../utils';
import { MathSol } from '../generalPoolMath';

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

  //Helper function to parse secondary issue pools data into params for onSell and onBuy functions.
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
      scalingFactors.push(BigInt(10 ** 18) * BigInt(10 ** (18 - _decimal)));
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
      scalingFactors,
      orders,
      secondaryTrades,
    };
    return poolPairData;
  }

  //constructs onchain multicall data for SecondaryIssue Pool.
  //To get pool(primary/secondary) tokens from vault contract, minimum orderSize secondary,
  getOnChainCalls(pool: SubgraphPoolBase, vaultAddress: string): callData[] {
    const poolCallData: callData[] = [
      {
        target: vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          pool.id,
        ]),
      },
      {
        target: pool.address,
        callData: this.poolInterface.encodeFunctionData('getMinOrderSize'),
      },
    ];
    return poolCallData;
  }

  //Decodes multicall data for SecondaryIssue pools. And save pools using address to poolState Mapping.
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

  // Helper function that get tokenIn when buying in both secondaery issue pools
  onBuy(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
    creator: string,
  ): bigint[] {
    return amounts.map(amount =>
      this.getSecondaryTokenIn(poolPairData, amount, creator!, isCurrencyIn),
    );
  }

  //Helper function that get tokenOut when selling in secondaery issue pools
  onSell(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
    creator: string,
  ): bigint[] | null {
    return amounts.map(amount =>
      this.getSecondaryTokenOut(poolPairData, amount, creator!, isCurrencyIn),
    );
  }

  //Helper function that calculates amount in or out for both buy and sell in secondary pool
  //according to calculation from SOR
  _getSecondaryTokenAmount(
    amount: bigint,
    ordersDataScaled: OrdersState[],
    scalingFactor: bigint,
    orderType: string,
  ): bigint {
    let returnAmount = BigInt(0);
    for (let i = 0; i < ordersDataScaled.length; i++) {
      const amountOffered = BigInt(
        Number(ordersDataScaled[i].amountOffered) * 10 ** 18,
      ); //manual upscale
      const priceOffered = BigInt(
        Number(ordersDataScaled[i].priceOffered) * 10 ** 18,
      ); //manual  upscale
      const checkValue =
        orderType === 'Sell'
          ? MathSol.divDownFixed(amountOffered, priceOffered)
          : MathSol.mulDownFixed(amountOffered, priceOffered);
      if (checkValue <= amount) {
        returnAmount = MathSol.add(returnAmount, amountOffered);
      } else {
        returnAmount = MathSol.add(
          returnAmount,
          orderType === 'Sell'
            ? MathSol.mulDownFixed(amount, priceOffered)
            : MathSol.divDownFixed(amount, priceOffered),
        );
      }
      amount = amount - checkValue;
      if (amount < 0n) {
        break;
      }
    }

    return returnAmount;
  }

  //gets amount of tokenOut in Secondary Issue pool(used when selling) according to calculation from SOR Repo
  getSecondaryTokenOut(
    poolPairData: PoolPairData,
    amount: bigint,
    creator: string,
    isCurrencyIn: boolean,
  ): bigint {
    try {
      let security: string;
      let scalingFactor;
      if (isCurrencyIn) {
        {
          security = poolPairData.tokens[poolPairData.indexOut];
          scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
        }
      } else {
        security = poolPairData.tokens[poolPairData.indexIn];
        scalingFactor = poolPairData.scalingFactors[poolPairData.indexOut];
      }
      if (amount == 0n) return 0n;
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
      openOrders = openOrders.filter(order => order.priceOffered !== 0n);
      if (poolPairData.secondaryTrades!.length) {
        buyOrders = openOrders
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
                  ? 1 / Number(matchedTrade.price)
                  : Number(matchedTrade.price);
              const amount = Number(matchedTrade.amount) * price;
              const amtCalculated = BigInt(
                (Number(order.amountOffered) - amount) * 10 ** 18,
              );

              return {
                ...order,
                amountOffered: amtCalculated,
                isMatched: amtCalculated === 0n ? false : true,
              };
            }
            return order;
          })
          .filter(element => element && element.amountOffered !== 0n);
      }
      buyOrders = buyOrders.sort(
        (a, b) => Number(b.priceOffered) - Number(a.priceOffered),
      );

      const orderBookdepth = buyOrders
        .map(order =>
          order.isMatched
            ? Number(order.amountOffered) / Number(order.priceOffered)
            : (Number(order.amountOffered) * 10 ** 18) /
              Number(order.priceOffered),
        )
        .reduce((partialSum, a) => partialSum + a, 0);
      if (Number(amount) > orderBookdepth) {
        return 0n;
      }

      return this._getSecondaryTokenAmount(
        amount,
        buyOrders,
        scalingFactor,
        'Sell',
      );
    } catch (error) {
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
      let scalingFactor;
      if (isCurrencyIn) {
        {
          currency = poolPairData.tokens[poolPairData.indexIn];
          security = poolPairData.tokens[poolPairData.indexOut];
          scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
        }
      } else {
        currency = poolPairData.tokens[poolPairData.indexOut];
        security = poolPairData.tokens[poolPairData.indexIn];
        scalingFactor = poolPairData.scalingFactors[poolPairData.indexOut];
      }
      const scaledAmount = MathSol.mul(amount, scalingFactor);
      if (scaledAmount == 0n) {
        return 0n;
      }
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
      openOrders = openOrders.filter(order => order.priceOffered !== 0n);
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
                  ? 1 / Number(matchedTrade.price)
                  : Number(matchedTrade.price);
              const amount = Number(matchedTrade.amount) * price;
              const amtCalculated = BigInt(
                (Number(order.amountOffered) - amount) * 10 ** 18,
              );

              return {
                ...order,
                amountOffered: amtCalculated,
                isMatched: amtCalculated === 0n ? false : true, //track upscaled amountOffered
              };
            }
            return order;
          })
          .filter(element => element && element.amountOffered !== 0n);
      }
      sellOrders = sellOrders.sort(
        (a, b) => Number(a.priceOffered) - Number(b.priceOffered),
      );
      const orderBookdepth = sellOrders
        .map(order =>
          order.isMatched
            ? Number(order.amountOffered) * Number(order.priceOffered)
            : Number(order.amountOffered) *
              10 ** 18 *
              Number(order.priceOffered),
        )
        .reduce((partialSum, a) => partialSum + a, 0);
      if (Number(amount) > orderBookdepth) {
        return 0n;
      }

      return this._getSecondaryTokenAmount(
        amount,
        sellOrders,
        scalingFactor,
        'Buy',
      );
    } catch (err) {
      return 0n;
    }
  }
}
