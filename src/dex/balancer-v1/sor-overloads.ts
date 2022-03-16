import { Contract } from '@ethersproject/contracts';
import { BaseProvider } from '@ethersproject/providers';
import BigNumber from 'bignumber.js';
import * as bmath from '@balancer-labs/sor/dist/bmath';
import CustomMultiAbi from '../../abi/balancer-v1/balancerCustomMulticall.json';
import { Pool as OldPool, Swap } from '@balancer-labs/sor/dist/types';
import { Address } from '../../types';

const POOL_FETCH_TIMEOUT = 5000;

// Original Implementation: https://github.com/balancer-labs/balancer-sor/blob/v1.0.0-1/src/types.ts
export interface Token {
  address: string;
  balance: BigNumber;
  decimals: number;
  denormWeight: BigNumber;
}

export interface Pool {
  id: string;
  swapFee: BigNumber;
  totalWeight: BigNumber;
  tokens: Token[];
  tokensList: string[];
}

export interface SubGraphPools {
  pools: SubGraphPool[];
}

export interface Pools {
  pools: Pool[];
}

export interface SubGraphPool {
  id: string;
  swapFee: string;
  totalWeight: string;
  publicSwap: string;
  tokens: SubGraphToken[];
  tokensList: string[];
}

export interface SubGraphToken {
  address: string;
  balance: string;
  decimals: string;
  denormWeight: string;
}

// Has almost the same logic as getAllPoolDataOnChain
// Modifies the balance of pools according to the on chain state
// at a certain blockNumber
export async function updatePoolState(
  pools: Pool[], // Warning the token balances of pools are modified
  multiAddress: string,
  provider: BaseProvider,
  blockNumber: number,
): Promise<void> {
  if (pools.length === 0) throw Error('There are no pools.');

  const contract = new Contract(multiAddress, CustomMultiAbi, provider);

  let addresses: string[][] = [];
  let total = 0;

  for (let i = 0; i < pools.length; i++) {
    let pool = pools[i];

    addresses.push([pool.id]);
    total++;
    pool.tokens.forEach(token => {
      addresses[i].push(token.address);
      total++;
    });
  }

  //Original: let results = await contract.getPoolInfo(addresses, total);
  let results = await contract.getPoolInfo(addresses, total, {
    blockTag: blockNumber,
  });

  let j = 0;
  for (let i = 0; i < pools.length; i++) {
    pools[i].tokens.forEach(token => {
      token.balance = bmath.bnum(results[j]);
      j++;
    });
  }
}

// Original Implementation: https://github.com/balancer-labs/balancer-sor/blob/master/src/multicall.ts)
// Modification: call the onChain querry on a paticular blockNumber
export async function getAllPoolDataOnChain(
  pools: SubGraphPools,
  multiAddress: string,
  provider: BaseProvider,
  blockNumber: number,
): Promise<Pools> {
  if (pools.pools.length === 0) throw Error('There are no pools.');

  const contract = new Contract(multiAddress, CustomMultiAbi, provider);

  let addresses: string[][] = [];
  let total = 0;

  for (let i = 0; i < pools.pools.length; i++) {
    let pool = pools.pools[i];

    addresses.push([pool.id]);
    total++;
    pool.tokens.forEach(token => {
      addresses[i].push(token.address);
      total++;
    });
  }

  //Original: let results = await contract.getPoolInfo(addresses, total);
  let results = await contract.getPoolInfo(addresses, total, {
    blockTag: blockNumber,
  });

  let j = 0;
  let onChainPools: Pools = { pools: [] };

  for (let i = 0; i < pools.pools.length; i++) {
    let tokens: Token[] = [];

    let p: Pool = {
      id: pools.pools[i].id,
      swapFee: bmath.scale(bmath.bnum(pools.pools[i].swapFee), 18),
      totalWeight: bmath.scale(bmath.bnum(pools.pools[i].totalWeight), 18),
      tokens: tokens,
      tokensList: pools.pools[i].tokensList,
    };

    pools.pools[i].tokens.forEach(token => {
      let bal = bmath.bnum(results[j]);
      j++;
      p.tokens.push({
        address: token.address,
        balance: bal,
        decimals: Number(token.decimals),
        denormWeight: bmath.scale(bmath.bnum(token.denormWeight), 18),
      });
    });
    onChainPools.pools.push(p);
  }
  return onChainPools;
}

// Original Implementation: https://github.com/balancer-labs/balancer-sor/blob/1d06567831ec688b98026b20057b8557b786daac/src/costToken.ts#L71
// Modification: Use internal pricing function instead of querrying onChain
export async function getCostOutputToken(
  // TokenAddr: string,
  OutputToken: PToken,
  GasPriceWei: BigNumber,
  SwapGasCost: BigNumber,
  // Provider: BaseProvider,
  // ChainId: number = undefined
): Promise<BigNumber> {
  // if (!ChainId) {
  //     let network = await Provider.getNetwork();
  //     ChainId = network.chainId;
  // }
  // If not mainnet return 0 as UniSwap price unlikely to be correct?
  // Provider can be used to fetch token data (i.e. Decimals) via UniSwap SDK when Ethers V5 is used
  // if (ChainId !== 1) return new BigNumber(0);
  // let tokenPrice = new BigNumber(0);
  // try {
  //     tokenPrice = await getTokenWeiPrice(TokenAddr, Provider);
  // } catch (err) {
  //     // If no pool for provided address (or addr incorrect) then default to 0
  //     logger.error('Error Getting Token Price. Defaulting to 0.');
  // }

  const network = 1; // TODO: is it changing for different networks?
  const priceApi = priceApis[network];

  // TODO: and write test for it.
  const ethPrice = new BigNumber(priceApi.getEthPrice());
  const tokenPrice = new BigNumber(
    await priceApi.getPrice(
      OutputToken,
      new BigNumber((10 ** OutputToken.decimals).toFixed()),
      undefined,
      true,
    ),
  );
  const tokenPriceInWei = ethPrice
    .times(new BigNumber(10).pow(OutputToken.decimals))
    .div(tokenPrice);

  let costOutputToken = calculateTotalSwapCost(
    tokenPriceInWei,
    SwapGasCost,
    GasPriceWei,
  );

  return costOutputToken;
}

// Original Implementation: https://github.com/balancer-labs/balancer-sor/blob/v1.0.0-1/src/helpers.ts
// No change has been made. This function doesn't exist in older SOR and is needed to convert the new SOR Pool
// to the older SOR Pool. The new SOR has the datatype PoolPairData which is equivalent to old SOR datatype
// Pool.
export const parsePoolPairData = (
  p: Pool,
  tokenIn: string,
  tokenOut: string,
): OldPool | null => {
  let tI = p.tokens.find(
    t => t.address.toLowerCase() === tokenIn.toLowerCase(),
  );
  // logger.debug("tI", tI.balance.toString(), tI);
  let tO = p.tokens.find(
    t => t.address.toLowerCase() === tokenOut.toLowerCase(),
  );

  // logger.debug("tO", tO.balance.toString()), tO);
  if (!tI || !tO) return null;

  let poolPairData = {
    id: p.id,
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    decimalsIn: tI.decimals,
    decimalsOut: tO.decimals,
    balanceIn: bmath.bnum(tI.balance),
    balanceOut: bmath.bnum(tO.balance),
    weightIn: bmath.scale(
      bmath.bnum(tI.denormWeight).div(bmath.bnum(p.totalWeight)),
      18,
    ),
    weightOut: bmath.scale(
      bmath.bnum(tO.denormWeight).div(bmath.bnum(p.totalWeight)),
      18,
    ),
    swapFee: bmath.bnum(p.swapFee),
  };

  return poolPairData;
};

// Origin Implementation: https://github.com/balancer-labs/balancer-sor/blob/v1.0.0-1/src/costToken.ts#L61
// No change made. Doesn't exist in the Old SOR.
export function calculateTotalSwapCost(
  TokenPrice: BigNumber,
  SwapCost: BigNumber,
  GasPriceWei: BigNumber,
): BigNumber {
  return GasPriceWei.times(SwapCost).times(TokenPrice).div(bmath.BONE);
}

export async function getAllPublicSwapPools(
  URL: string,
): Promise<SubGraphPools> {
  return (await Utils._get(URL, POOL_FETCH_TIMEOUT)).data;
}
