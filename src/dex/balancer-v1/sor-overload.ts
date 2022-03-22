import { Contract } from '@ethersproject/contracts';
import { BaseProvider } from '@ethersproject/providers';
import { Token as PToken } from '../../../models/token';
import BigNumber from 'bignumber.js';
import * as bmath from '@balancer-labs/sor/dist/bmath';
import CustomMultiAbi from '../../abi/balancerCustomMulticall.json';
import { Pool as OldPool, Swap } from '@balancer-labs/sor/dist/types';
import { priceApis } from '../../price-api';
import { Utils } from '../../utils';
import { Address } from '../../types';

const logger = global.LOGGER();

const POOL_FETCH_TIMEOUT = 5000;

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

export async function getAllPublicSwapPools(
  URL: string,
): Promise<SubGraphPools> {
  return (await Utils._get(URL, POOL_FETCH_TIMEOUT)).data;
}
