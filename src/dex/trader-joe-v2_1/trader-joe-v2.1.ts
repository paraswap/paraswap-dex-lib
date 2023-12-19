// import { Network, SwapSide } from '../../constants';
// import {
//   AdapterExchangeParam,
//   Address,
//   Logger,
//   SimpleExchangeParam,
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
// import { getDexKeysWithNetwork } from '../../utils';
// import { Adapters, TraderJoeV2_1Config } from './config';

// const TRADERJOE_V2_1_ROUTER_ADDRESS: { [network: number]: Address } = {
//   [Network.AVALANCHE]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
//   [Network.ARBITRUM]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
//   [Network.BSC]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
//   [Network.MAINNET]: '0x9A93a421b74F1c5755b83dD2C211614dC419C44b',
// };

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
//     // this.subgraphURL = config[network].subgraphURL;
//     // this.initCode = config[network].initCode;
//     // const factoryAbi = this.isLayer1()
//     //   ? SmardexFactoryLayerOneABI
//     //   : SmardexFactoryLayerTwoABI;
//     this.factory = new dexHelper.web3Provider.eth.Contract(
//       factoryAbi as any,
//       this.factoryAddress,
//     );
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
// }
