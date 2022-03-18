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

export async function getAllPublicSwapPools(
  URL: string,
): Promise<SubGraphPools> {
  return (await Utils._get(URL, POOL_FETCH_TIMEOUT)).data;
}
