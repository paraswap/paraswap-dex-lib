// import { Network, SwapSide } from '../../constants';
// import {
//   AdapterExchangeParam,
//   Address,
//   ExchangePrices,
//   Logger,
//   PoolPrices,
//   SimpleExchangeParam,
//   Token,
// } from '../../types';
// import { IDex, IDexTxBuilder } from '../idex';
// import { IDexHelper } from '../../dex-helper';
// import {
//   getLocalDeadlineAsFriendlyPlaceholder,
//   SimpleExchange,
// } from '../simple-exchange';
// import { NumberAsString } from '@paraswap/core';
// import { AsyncOrSync } from 'ts-essentials';
// import { Interface, JsonFragment } from '@ethersproject/abi';
// import TraderJoeV21RouterABI from '../../abi/TraderJoeV21Router.json';
// import { getBigIntPow, getDexKeysWithNetwork, interpolate } from '../../utils';
// import { Adapters, TraderJoeV2_1Config } from './config';
// // import * as CALLDATA_GAS_COST from '../calldata-gas-cost';
// import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
// import {
//   TRADER_JOE_V2_CHUNKS,
//   TRADER_JOE_V2_QUOTE_GASLIMIT,
// } from './constants';
// import { LBPairsAvailable } from './types';

// type RouterPath = [
//   pairBinSteps: NumberAsString[],
//   versions: NumberAsString[],
//   tokenPath: Address[],
// ];
// type TraderJoeV2RouterSellParams = [
//   _amountIn: NumberAsString,
//   _amountOutMin: NumberAsString,
//   _routerPath: RouterPath,
//   to: Address,
//   _deadline: string,
// ];

// type TraderJoeV2RouterBuyParams = [
//   _amountOut: NumberAsString,
//   _amountInMax: NumberAsString,
//   _routerPath: RouterPath,
//   to: Address,
//   _deadline: string,
// ];

// type TraderJoeV2RouterParam =
//   | TraderJoeV2RouterSellParams
//   | TraderJoeV2RouterBuyParams;

// export type TraderJoeV2Data = {
//   tokenIn: string; // redundant
//   tokenOut: string; // redundant
//   binStep: string;
// };

// enum TraderJoeV2RouterFunctions {
//   swapExactTokensForTokens = 'swapExactTokensForTokens',
//   swapTokensForExactTokens = 'swapTokensForExactTokens',
// }
// export class TraderJoeV21
//   extends SimpleExchange
//   implements IDex<TraderJoeV2Data, TraderJoeV2RouterParam>
// {
//   availablePools: { [key: string]: string } = {};
//   // pairs: { [key: string]: SmardexPair } = {};
//   // factory: Contract;

//   // routerInterface: Interface;
//   exchangeRouterInterface: Interface;

//   factoryAddress: string;
//   routerAddress: string;

//   protected subgraphURL: string | undefined;

//   logger: Logger;

//   needWrapNative = true;
//   public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
//     getDexKeysWithNetwork(TraderJoeV2_1Config);

//   constructor(
//     protected network: Network,
//     dexKey: string,
//     public dexHelper: IDexHelper,
//     protected adapters = Adapters[network] || {},
//   ) {
//     super(dexHelper, dexKey);
//     this.logger = dexHelper.getLogger(dexKey);
//     const config = TraderJoeV2_1Config[dexKey];
//     this.routerAddress = config[network].routerAddress!;
//     this.factoryAddress = config[network].factoryAddress;
//     // const factoryAbi = this.isLayer1()
//     //   ? SmardexFactoryLayerOneABI
//     //   : SmardexFactoryLayerTwoABI;
//     // this.factory = new dexHelper.web3Provider.eth.Contract(
//     //   factoryAbi as any,
//     //   this.factoryAddress,
//     // );
//     // this.routerInterface = new Interface(ParaSwapABI);
//     this.exchangeRouterInterface = new Interface(
//       TraderJoeV21RouterABI as JsonFragment[],
//     );

//     // super(dexHelper, 'traderjoev2.1');

//     // this.routerAddress =
//     //   TraderJoeV2_1Config[dexHelper.config.data.network].routerAddress;
//     // // this.routerAddress =
//     // //   TRADERJOE_V2_1_ROUTER_ADDRESS[dexHelper.config.data.network];

//     // this.exchangeRouterInterface = new Interface(
//     //   TraderJoeV21RouterABI as JsonFragment[],
//     // );
//   }

//   getAdapterParam(
//     srcToken: Address,
//     destToken: Address,
//     srcAmount: NumberAsString,
//     destAmount: NumberAsString,
//     data: TraderJoeV2Data,
//     side: SwapSide,
//   ): AdapterExchangeParam {
//     let payload = this.abiCoder.encodeParameters(
//       ['tuple(tuple(uint256[],uint8[],address[]),uint256)'],
//       [
//         [
//           [
//             [
//               data.binStep, // _pairBinSteps: uint256[]
//             ],
//             [
//               2, // _versions: uint8[]
//             ],
//             [
//               data.tokenIn,
//               data.tokenOut, // _tokenPath: address[]
//             ],
//           ],
//           getLocalDeadlineAsFriendlyPlaceholder(), // _deadline: uint256
//         ],
//       ],
//     );

//     return {
//       targetExchange: this.routerAddress,
//       payload,
//       networkFee: '0',
//     };
//   }

//   getSimpleParam(
//     srcToken: Address,
//     destToken: Address,
//     srcAmount: NumberAsString,
//     destAmount: NumberAsString,
//     data: TraderJoeV2Data,
//     side: SwapSide,
//   ): AsyncOrSync<SimpleExchangeParam> {
//     const swapFunction =
//       side === SwapSide.SELL
//         ? TraderJoeV2RouterFunctions.swapExactTokensForTokens
//         : TraderJoeV2RouterFunctions.swapTokensForExactTokens;

//     const swapFunctionParams: TraderJoeV2RouterParam =
//       side === SwapSide.SELL
//         ? [
//             srcAmount,
//             destAmount,
//             [[data.binStep], ['2'], [srcToken, destToken]],
//             this.augustusAddress,
//             getLocalDeadlineAsFriendlyPlaceholder(),
//           ]
//         : [
//             destAmount,
//             srcAmount,
//             [[data.binStep], ['2'], [srcToken, destToken]],
//             this.augustusAddress,
//             getLocalDeadlineAsFriendlyPlaceholder(),
//           ];

//     const swapData = this.exchangeRouterInterface.encodeFunctionData(
//       swapFunction,
//       swapFunctionParams,
//     );

//     return this.buildSimpleParamWithoutWETHConversion(
//       srcToken,
//       srcAmount,
//       destToken,
//       destAmount,
//       swapData,
//       this.routerAddress,
//     );
//   }

//   async getPricesVolume(
//     from: Token,
//     to: Token,
//     amounts: bigint[],
//     side: SwapSide,
//     routeID: number,
//     usedPools: { [poolIdentifier: string]: number } | null,
//   ): Promise<null | ExchangePrices<TraderJoeV2Data>> {
//     try {
//       const _from = this.dexHelper.config.wrapETH(from);
//       const _to = this.dexHelper.config.wrapETH(to);

//       const pools = await this.getPools(_from, _to);

//       if (!pools || !pools.length) return null;

//       const filteredPools = !usedPools
//         ? pools
//         : pools.filter(p => usedPools[this.getPoolIdentifier(p)] === routeID);

//       if (!filteredPools.length) return null;

//       const unitVolume = getBigIntPow(
//         (side === SwapSide.SELL ? _from : _to).decimals,
//       );

//       const chunks = amounts.length - 1;

//       const _width = Math.floor(chunks / TRADER_JOE_V2_CHUNKS);

//       const _amounts = [unitVolume].concat(
//         Array.from(Array(TRADER_JOE_V2_CHUNKS).keys()).map(
//           i => amounts[(i + 1) * _width],
//         ),
//       );

//       const calldata = filteredPools.flatMap(pool =>
//         _amounts.map(_amount => ({
//           target: this.routerAddress,
//           gasLimit: TRADER_JOE_V2_QUOTE_GASLIMIT,
//           callData: (side === SwapSide.SELL
//             ? this.router.methods.getSwapOut(
//                 pool.LBPair,
//                 _amount.toString(),
//                 _from.address === pool.tokenX,
//               )
//             : this.router.methods.getSwapIn(
//                 pool.LBPair,
//                 _amount.toString(),
//                 _from.address === pool.tokenX,
//               )
//           ).encodeABI(),
//         })),
//       );

//       const data = await this.uniswapMulti.methods.multicall(calldata).call();

//       const quoteIndex = side === SwapSide.SELL ? 1 : 0;
//       const quoteLeftIndex = side === SwapSide.SELL ? 0 : 1;

//       const prices = filteredPools.map((pool, i) => {
//         const rates = _amounts.map((_, j) => {
//           if (!data.returnData[i * _amounts.length + j].success) {
//             return 0n;
//           }

//           const decoded = defaultAbiCoder.decode(
//             // amountInLeft amountOut fee
//             ['uint128', 'uint128', 'uint128'],
//             data.returnData[i * _amounts.length + j].returnData,
//           );

//           if (BigInt(decoded[quoteLeftIndex]).valueOf() !== 0n) {
//             return BigInt(0);
//           }

//           return BigInt(decoded[quoteIndex].toString());
//         });

//         // index of pools, isolate pool

//         const unit: bigint = rates[0];

//         const prices = interpolate(
//           _amounts.slice(1),
//           rates.slice(1),
//           amounts,
//           side,
//         );

//         return {
//           prices,
//           unit,
//           data: {
//             tokenIn: _from.address, // redundant, fix by contract change
//             tokenOut: _to.address, // same
//             binStep: pool.binStep.toString(),
//           },
//           poolIdentifier: this.getPoolIdentifier(pool),
//           exchange: this.routerAddress,
//           gasCost: TRADER_JOE_V2_QUOTE_GASLIMIT,
//           poolAddresses: [pool.LBPair],
//         };
//       });

//       return prices;
//     } catch (e) {
//       this.logger.error(
//         `Error_getPrices: ${this.dexKey} for pair (${
//           from.symbol || from.address
//         }, ${to.symbol || to.address}) and side=${side}:`,
//         e,
//       );
//       return null;
//     }
//   }

//   private async getPools(
//     tokenA: Token,
//     tokenB: Token,
//   ): Promise<LBPairsAvailable[] | undefined> {
//     try {
//       const cacheKey = this.computeCacheKey(tokenA.address, tokenB.address);
//       // TODO: Improve
//       const poolsInCache = await this.dexHelper.cache.rawget(cacheKey);

//       if (!!poolsInCache) {
//         return JSON.parse(poolsInCache);
//       }

//       // warning: order between tokenX and tokenY is not guranteed on LBPairs
//       const [tokenX, tokenY] = this._sortTokens(tokenA.address, tokenB.address);

//       const pools: LBPairsAvailable[] =
//         (await this.factory.methods.getAllLBPairs(tokenX, tokenY).call()) || [];

//       if (!pools.length) {
//         await this.dexHelper.cache.setex(cacheKey, EMPTY_POOL_CACHE_TTL, '[]');
//         return [];
//       }

//       const getTokenXCallData = pools.map(pool => ({
//         target: pool.LBPair,
//         gasLimit: TRADER_JOE_V2_QUOTE_GASLIMIT,
//         callData: this.pair.methods.getTokenX().encodeABI(),
//       }));

//       const data = await this.uniswapMulti.methods
//         .multicall(getTokenXCallData)
//         .call();

//       const _pools = pools.map((pool, i) => {
//         const decodedTokenX = defaultAbiCoder
//           .decode(['address'], data.returnData[i].returnData)[0]
//           .toString()
//           .toLowerCase();

//         return {
//           ...pool,
//           tokenX: decodedTokenX,
//         };
//       });

//       await RedisWrapper.setex(
//         cacheKey,
//         POPULATED_POOL_CACHE_TTL,
//         JSON.stringify(_pools),
//       );

//       return _pools;
//     } catch (e) {
//       logger.error(
//         `${EXCHANGES.TRADERJOE_V2_1} Error 'poolByPair' reading from factory for pair: ${tokenA.address} and ${tokenA.address}:`,
//         e,
//       );
//       return;
//     }
//   }

//   protected getPoolIdentifier(pool: LBPairsAvailable) {
//     return `${EXCHANGES.TRADERJOE_V2_1}_${pool.LBPair}`;
//   }

//   // FIXME
//   getCalldataGasCost(
//     poolPrices: PoolPrices<TraderJoeV2Data>,
//   ): number | number[] {
//     return (
//       CALLDATA_GAS_COST.DEX_OVERHEAD +
//       CALLDATA_GAS_COST.LENGTH_SMALL +
//       // ParentStruct header
//       CALLDATA_GAS_COST.OFFSET_SMALL +
//       // ParentStruct -> path header
//       CALLDATA_GAS_COST.OFFSET_SMALL +
//       // ParentStruct -> deadline
//       CALLDATA_GAS_COST.TIMESTAMP +
//       // ParentStruct -> path (20+3+20 = 43 = 32+11 bytes)
//       CALLDATA_GAS_COST.LENGTH_SMALL +
//       CALLDATA_GAS_COST.FULL_WORD +
//       CALLDATA_GAS_COST.wordNonZeroBytes(11)
//     );
//   }

//   async getPoolIdentifiers(
//     _from: Token,
//     _to: Token,
//     side: SwapSide,
//     blockNumber: number,
//   ): Promise<string[]> {
//     const from = this.dexHelper.config.wrapETH(_from);
//     const to = this.dexHelper.config.wrapETH(_to);

//     if (from.address.toLowerCase() === to.address.toLowerCase()) {
//       return [];
//     }

//     const tokenAddress = [from.address.toLowerCase(), to.address.toLowerCase()]
//       .sort((a, b) => (a > b ? 1 : -1))
//       .join('_');

//     const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
//     return [poolIdentifier];
//   }

//   protected computeCacheKey(from: Address, to: Address): string {
//     return `${this.dexKey}_${this.network}_${this._sortTokens(from, to).join(
//       '_',
//     )}_2`;
//   }

//   private _sortTokens(srcAddress: Address, destAddress: Address) {
//     return [srcAddress.toLowerCase(), destAddress.toLowerCase()].sort((a, b) =>
//       a < b ? -1 : 1,
//     );
//   }

//   // protected getPoolIdentifier(pool: LBPairsAvailable) {
//   //   return `${EXCHANGES.TRADERJOE_V2_1}_${pool.LBPair}`;
//   // }
// }
