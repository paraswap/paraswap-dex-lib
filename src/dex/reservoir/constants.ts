// 100%, so 1 represents 1% of a basis point, or 0.0001%
import { Interface } from '@ethersproject/abi';
import ReservoirPairABI from '../../abi/reservoir/ReservoirPair.json';
import StablePairABI from '../../abi/reservoir/StablePair.json';

export const FEE_ACCURACY: bigint = 1_000_000n;
// precision for the amplification coefficient of stableswap
export const A_PRECISION: bigint = 100n;
// uint104
export const RESERVE_LIMIT = 2n ** 104n - 1n;

export const reservoirPairIface = new Interface(ReservoirPairABI);
export const stablePairIface = new Interface(StablePairABI);
