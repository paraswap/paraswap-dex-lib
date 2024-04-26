import { Interface } from '@ethersproject/abi';
import { Network, SwapSide } from '../../../../constants';
import { IDexHelper } from '../../../../dex-helper';
import { DexConfigMap, SimpleExchangeParam } from '../../../../types';
import { getDexKeysWithNetwork } from '../../../../utils';
import {
  DexParams,
  UniswapV3Data,
  UniswapV3Functions,
  UniswapV3SimpleSwapBuyParam,
  UniswapV3SimpleSwapSellParam,
} from '../../types';
import { UniswapV3 } from '../../uniswap-v3';
import AlienBaseV3RouterABI from '../../../../abi/uniswap-v3/AlienBaseV3Router.abi.json';

export const AlienBaseV3Config: DexConfigMap<DexParams> = {
  AlienBaseV3: {
    [Network.BASE]: {
      factory: '0x0Fd83557b2be93617c9C1C1B6fd549401C74558C',
      quoter: '0x4fDBD73aD4B1DDde594BF05497C15f76308eFfb9',
      router: '0xB20C411FC84FBB27e78608C24d0056D974ea9411',
      supportedFees: [10000n, 3000n, 750n, 200n],
      stateMulticall: '0x7160f736c52e1e78e92FD4eE4D73e21A7Cf4F950',
      uniswapMulticall: '0x091e99cb1C49331a94dD62755D168E941AbD0693',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: 'https://api.studio.thegraph.com/query/59130/v3alb/0.3',
    },
  },
};

type AlienBaseV3SimpleSwapParams =
  | Omit<UniswapV3SimpleSwapSellParam, 'deadline'>
  | Omit<UniswapV3SimpleSwapBuyParam, 'deadline'>;

export class AlienBaseV3 extends UniswapV3 {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AlienBaseV3Config);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      {},
      new Interface(AlienBaseV3RouterABI),
      undefined,
      AlienBaseV3Config[dexKey][network],
    );
  }

  static getDirectFunctionName(): string[] {
    return [];
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? UniswapV3Functions.exactInput
        : UniswapV3Functions.exactOutput;

    const path = this._encodePath(data.path, side);
    const swapFunctionParams: AlienBaseV3SimpleSwapParams =
      side === SwapSide.SELL
        ? {
            recipient: this.augustusAddress,
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            path,
          }
        : {
            recipient: this.augustusAddress,
            amountOut: destAmount,
            amountInMaximum: srcAmount,
            path,
          };

    const swapData = this.routerIface.encodeFunctionData(swapFunction, [
      swapFunctionParams,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.router,
    );
  }
}
