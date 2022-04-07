import { Address, Token } from '../../types';

export type PoolState = {
  tin: bigint; // toll in
  tout: bigint; // toll out
  Art: bigint; // encumbered normalized debt
  rate: bigint;
  line: bigint; // debt ceiling
};

export type MakerPsmData = {
  psmAddress: Address;
  gemJoinAddress: Address;
  gemDecimals: number;
  tin: string;
  tout: string;
};

export type PoolConfig = {
  gem: Token;
  gemJoinAddress: Address;
  psmAddress: Address;
  identifier: string; // bytes32 of pool identifier (Eg. bytes32("PSM-USDC-A"))
};

export type DexParams = {
  dai: Token;
  vatAddress: Address;
  pools: PoolConfig[];
};
