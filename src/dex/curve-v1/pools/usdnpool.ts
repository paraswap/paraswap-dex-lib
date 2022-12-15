// import BigNumber from 'bignumber.js';
// import { Address } from '../../types';
// import { ThreePool } from './3pool';
// import StableSwapUSDN from '../../abi/curve-v1/StableSwapUSDN.json';
// import { CurveMetapool } from './curve-metapool';
//
// const bignumberify = (val: any) => new BigNumber(val);
// const stringify = (val: any) => val.toString();

// We can't support USDNPool as USDN is not a standard ERC20, when a transfer is made
// there is some additional rewards distributed.
// USDN Contract: https://etherscan.io/address/0x674c6ad92fd080e4004b2312b45f796a192d27a0#code
// TODO: Come up with a fix!

// const pool = 'usdn';
// export const address: Address = '0x0f9cb53Ebe405d49A0bbdBD291A65Ff571bC83e1'.toLowerCase();
// const tokenAddress: Address = '0x4f3E8F405CF5aFC05D68142F3783bDfE13811522';
// const N_COINS: number = 2;
// const PRECISION_MUL = ['1', '1'].map(bignumberify);
// const USE_LENDING = [false, false];
// const COINS = [
//   '0x674C6Ad92Fd080e4004b2312b45f796a192D27a0',
//   '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
// ];
// const trackCoins = true;

// export class USDNPool extends CurveMetapool {
//   constructor(
//     parentName: string,
//     web3Provider: any,
//     network: number,
//     _pool = pool,
//     _address = address,
//     _tokenAddress = tokenAddress,
//     _trackCoins = trackCoins,
//     _abi: any = StableSwapUSDN,
//     _N_COINS = N_COINS,
//     _PRECISION_MUL = PRECISION_MUL,
//     _USE_LENDING = USE_LENDING,
//     _COINS = COINS,
//     basepool = ThreePool,
//   ) {
//     super(
//       parentName,
//       web3Provider,
//       network,
//       _pool,
//       _address,
//       _tokenAddress,
//       _trackCoins,
//       _abi,
//       _N_COINS,
//       _PRECISION_MUL,
//       _USE_LENDING,
//       _COINS,
//       basepool,
//     );
//   }
// }
