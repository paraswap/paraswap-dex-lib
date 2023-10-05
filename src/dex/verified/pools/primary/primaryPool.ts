// import { BasePool } from '../../../balancer-v2/pools/balancer-v2-pool';
// import { Interface } from '@ethersproject/abi';
// import PRIMARYISSUEPOOL from "../../../../abi/verified/PrimaryIssuePool.json";
// import { PoolPairData, PoolState, SubgraphPoolBase, TokenState, VerifiedPoolTypes, callData } from '../../types';
// import { decodeThrowError } from '../../utils';

// export class PrimaryIssuePool extends BasePool {
//   vaultAddress: string;
//   vaultInterface: Interface;
//   public poolInterface: Interface;

//   constructor(vaultAddress: string, vaultInterface: Interface) {
//     super();
//     this.vaultAddress = vaultAddress;
//     this.vaultInterface = vaultInterface;
//     this.poolInterface = new Interface(PRIMARYISSUEPOOL.abi);
//   }

//    /*
//     Helper function to parse pool data into params for onSell function.
//     */
//   parsePoolPairData(
//     pool: SubgraphPoolBase,
//     poolState: PoolState,
//     tokenIn: string,
//     tokenOut: string,
//   ): PoolPairData {
//     let indexIn = 0;
//     let indexOut = 0;
//     let bptIndex = 0;
//     const balances: bigint[] = [];
//     const tokens = poolState.orderedTokens.map((tokenAddress, i) => {
//       const t = pool.tokensMap[tokenAddress.toLowerCase()];
//       if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
//       if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
//       if (t.address.toLowerCase() === pool.address.toLowerCase()) bptIndex = i;
//       balances.push(poolState.tokens[t.address.toLowerCase()].balance);
//       return t.address;
//     });

//     const poolPairData: PoolPairData = {
//         tokens,
//         balances,
//         indexIn,
//         indexOut,
//         bptIndex,
//         swapFee: poolState.swapFee,
//         minOrderSize: poolState.minimumOrderSize,

//     };
//     return poolPairData;
//   }

// }
