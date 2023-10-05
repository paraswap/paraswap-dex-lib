import { getAddress } from '@ethersproject/address';
import { Interface, Result } from '@ethersproject/abi';
import { getBigIntPow } from '../../utils';
import { BI_POWS } from '../../bigint-constants';

import {
  VerifiedPoolTypes,
  SubgraphMainToken,
  SubgraphPoolAddressDictionary,
  SubgraphPoolBase,
  SubgraphToken,
  OrdersState,
  PoolState,
  PoolPairData,
  TokenState,
  callData,
} from './types';
import { reverse, uniqBy } from 'lodash';
import { MathSol } from '../balancer-v2/balancer-v2-math';
import { SwapSide } from '../../constants';
import { Log } from '../../types';
import { DeepReadonly } from 'ts-essentials';
import _ from 'lodash';
import {
  PRIMARY_POOL_INTERFACE,
  SECONDARY_POOL_INTERFACE,
  VAULT_INTERFACE,
} from './constants';

interface BalancerPathHop {
  pool: SubgraphPoolBase;
  tokenIn: SubgraphToken;
  tokenOut: SubgraphToken;
}

export function decodeThrowError(
  contractInterface: Interface,
  functionName: string,
  resultEntry: { success: boolean; returnData: any },
  poolAddress: string,
): Result {
  if (!resultEntry.success)
    throw new Error(`Failed to execute ${functionName} for ${poolAddress}`);
  return contractInterface.decodeFunctionResult(
    functionName,
    resultEntry.returnData,
  );
}

function isPrimaryPool(poolType: string): boolean {
  return poolType == VerifiedPoolTypes.PrimaryIssuePool;
}

function isSecondaryPool(poolType: string): boolean {
  return poolType == VerifiedPoolTypes.SecondaryIssuePool;
}

export function isSupportedPool(poolType: string): boolean {
  return (
    poolType == VerifiedPoolTypes.PrimaryIssuePool ||
    poolType == VerifiedPoolTypes.SecondaryIssuePool
  );
}

//Todo: confirm this handles both primary and secondary
export function poolGetMainTokens(
  pool: Omit<SubgraphPoolBase, 'mainTokens'>,
  poolsMap: SubgraphPoolAddressDictionary,
): SubgraphMainToken[] {
  let mainTokens: SubgraphMainToken[] = [];

  for (const token of pool.tokens) {
    //skip bpt token
    if (token.address === pool.address) {
      continue;
    }
    const tokenPool = poolsMap[token.address];
    if (tokenPool && isSupportedPool(tokenPool.poolType)) {
      //since primary main token is the security token used
      const securityToken = pool.tokens.find(token => {
        token.address === tokenPool.security;
      })!;
      mainTokens.push({
        ...securityToken,
        poolToken: token,
        pathToToken: [
          {
            poolId: tokenPool.id,
            poolAddress: tokenPool.address,
            token: securityToken,
          },
        ],
      });
    } else {
      mainTokens.push({
        ...token,
        pathToToken: [],
        poolToken: token,
      });
    }
  }

  return mainTokens;
}

export function getNewAmount(max: bigint, num: bigint): bigint {
  return max >= num ? num : 0n;
}
//Helper function to parse both primary and secondary issue pools data into params for onSell and onBuy functions.
export function parsePoolPairData(
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
//helper function that gets amount of token for Secondary issue pool(used when buying and selling) according to calculation from SOR Repo
export function _getSecondaryTokenAmount(
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
//TODO: Verify if token decimals are not nedded to get actual balance(depending on the format of amount in)
//gets maxAmount that can be swapped in or out of both primary and secondary issue pools
//use 99% of the balance so not all balance can be swapped.
export function getSwapMaxAmount(
  poolPairData: PoolPairData,
  side: SwapSide,
): bigint {
  return (
    ((side === SwapSide.SELL
      ? poolPairData.balances[poolPairData.indexIn]
      : poolPairData.balances[poolPairData.indexOut]) *
      99n) /
    100n
  );
}

export function handleSwap(event: any, pool: PoolState, log: Log): PoolState {
  const tokenIn = event.args.tokenIn.toLowerCase();
  const amountIn = BigInt(event.args.amountIn.toString());
  const tokenOut = event.args.tokenOut.toLowerCase();
  const amountOut = BigInt(event.args.amountOut.toString());
  pool.tokens[tokenIn].balance += amountIn;
  pool.tokens[tokenOut].balance -= amountOut;
  return pool;
}

export function handlePoolBalanceChanged(
  event: any,
  pool: PoolState,
  log: Log,
): PoolState {
  const tokens = event.args.tokens.map((t: string) => t.toLowerCase());
  const deltas = event.args.deltas.map((d: any) => BigInt(d.toString()));
  const fees = event.args.protocolFeeAmounts.map((d: any) =>
    BigInt(d.toString()),
  ) as bigint[];
  tokens.forEach((t: string, i: number) => {
    const diff = deltas[i] - fees[i];
    pool.tokens[t].balance += diff;
  });
  return pool;
}

export function typecastReadOnlyPoolState(
  pool: DeepReadonly<PoolState>,
): PoolState {
  return _.cloneDeep(pool) as PoolState;
}

//constructs onchain multicall data for Both Primary and SecondaryIssue Pool.
//To get pool(primary/secondary) tokens from vault contract, minimum orderSize from primary and secondary,
//minimumprice from primary
export function getOnChainCalls(
  pool: SubgraphPoolBase,
  vaultAddress: string,
): callData[] {
  const poolCallData: callData[] = [
    {
      target: vaultAddress,
      callData: VAULT_INTERFACE.encodeFunctionData('getPoolTokens', [pool.id]),
    },
  ];
  if (pool.poolType === VerifiedPoolTypes.PrimaryIssuePool) {
    poolCallData.push({
      target: pool.address,
      callData: PRIMARY_POOL_INTERFACE.encodeFunctionData('getMinimumPrice'),
    });
    poolCallData.push({
      target: pool.address,
      callData: PRIMARY_POOL_INTERFACE.encodeFunctionData(
        'getMinimumOrderSize',
      ),
    });
  }
  if (pool.poolType === VerifiedPoolTypes.SecondaryIssuePool) {
    poolCallData.push({
      target: pool.address,
      callData: SECONDARY_POOL_INTERFACE.encodeFunctionData('getMinOrderSize'),
    });
  }

  return poolCallData;
}

//Decodes multicall data for both Primary and SecondaryIssue pools. And save pools using address to poolState Mapping.
//Data must contain returnData. StartIndex is where to start in returnData.
export function decodeOnChainCalls(
  pool: SubgraphPoolBase,
  data: { success: boolean; returnData: any }[],
  startIndex: number,
): [{ [address: string]: PoolState }, number] {
  const pools = {} as { [address: string]: PoolState };
  let minimumOrderSize: any;
  let minimumPrice: any;

  const poolTokens = decodeThrowError(
    VAULT_INTERFACE,
    'getPoolTokens',
    data[startIndex++],
    pool.address,
  );

  if (pool.poolType === VerifiedPoolTypes.PrimaryIssuePool) {
    minimumOrderSize = decodeThrowError(
      PRIMARY_POOL_INTERFACE,
      'getMinimumOrderSize',
      data[startIndex++],
      pool.address,
    )[0];

    minimumPrice = decodeThrowError(
      PRIMARY_POOL_INTERFACE,
      'getMinimumPrice',
      data[startIndex++],
      pool.address,
    )[0];
  }

  if (pool.poolType === VerifiedPoolTypes.SecondaryIssuePool) {
    minimumOrderSize = decodeThrowError(
      SECONDARY_POOL_INTERFACE,
      'getMinOrderSize',
      data[startIndex++],
      pool.address,
    )[0];
  }

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
    minimumPrice,
  };

  pools[pool.address] = poolState;

  return [pools, startIndex];
}
