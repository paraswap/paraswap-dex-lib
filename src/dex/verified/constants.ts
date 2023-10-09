import VAULTABI from '../../abi/verified/vault.json';
import PRIMARYISSUE from '../../abi/verified/PrimaryIssuePool.json';
import SECONDARYISSUE from '../../abi/verified/SecondaryIssuePool.json';
import { Interface } from 'ethers/lib/utils';

export const MIN_USD_LIQUIDITY_TO_FETCH = 100n;
export const MAX_POOL_CNT = 1000; // Taken from SOR
export const POOL_CACHE_TTL = 60 * 60; // 1 hr
export const VAULT_INTERFACE = new Interface(VAULTABI);
export const PRIMARY_POOL_INTERFACE = new Interface(PRIMARYISSUE.abi);
export const SECONDARY_POOL_INTERFACE = new Interface(SECONDARYISSUE.abi);
