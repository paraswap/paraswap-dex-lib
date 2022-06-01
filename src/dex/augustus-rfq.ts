import { Interface, JsonFragment } from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { SwapSide, Network } from '../constants';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import AugustusRFQABI from '../abi/paraswap-limit-orders/AugustusRFQ.abi.json';

export type AugustusRFQOrderData = {
  nonceAndMeta: string;
  expiry: number;
  makerAsset: string; // For non-NFT order this is an Address
  makerAssetId?: string; // NFT orders only
  takerAsset: string; // For non-NFT order this is an Address
  takerAssetId?: string; // NFT orders only
  maker: Address;
  taker: Address;
  makerAmount: string;
  takerAmount: string;
  signature: string;
  permitMakerAsset?: string; // TODO: add support
};

type AugustusRFQOrderParam = {
  nonceAndMeta: string;
  expiry: number;
  makerAsset: Address;
  takerAsset: Address;
  maker: Address;
  taker: Address;
  makerAmount: string;
  takerAmount: string;
};

type AugustusRFQOrderNFTParam = {
  nonceAndMeta: string;
  expiry: number;
  makerAsset: string;
  makerAssetId: string;
  takerAsset: string;
  takerAssetId: string;
  maker: Address;
  taker: Address;
  makerAmount: string;
  takerAmount: string;
};

type FillOrderParam = [order: AugustusRFQOrderParam, signature: string];
type FillOrderNFTParam = [order: AugustusRFQOrderNFTParam, signature: string];

type AugustusRFQParam = FillOrderParam | FillOrderNFTParam;

enum AugustusRFQFunctions {
  fillOrder = 'fillOrder',
  fillOrderNFT = 'fillOrderNFT',
}

const AUGUSTUS_RFQ_ADDRESS: { [network: number]: Address } = {
  [Network.MAINNET]: '0xe92b586627ccA7a83dC919cc7127196d70f55a06',
  [Network.ROPSTEN]: '0x34268C38fcbC798814b058656bC0156C7511c0E4',
  [Network.BSC]: '0x8DcDfe88EF0351f27437284D0710cD65b20288bb',
  [Network.POLYGON]: '0xF3CD476C3C4D3Ac5cA2724767f269070CA09A043',
  [Network.AVALANCHE]: '0x34302c4267d0dA0A8c65510282Cc22E9e39df51f',
  [Network.FANTOM]: '0x2DF17455B96Dde3618FD6B1C3a9AA06D6aB89347',
};

export class AugustusRFQOrder
  extends SimpleExchange
  implements IDexTxBuilder<AugustusRFQOrderData, AugustusRFQParam>
{
  static dexKeys = ['augustusrfqorder'];
  rfqInterface: Interface;
  needWrapNative = true;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: Provider,
  ) {
    super(augustusAddress, provider);
    this.rfqInterface = new Interface(AugustusRFQABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AugustusRFQOrderData,
    side: SwapSide,
  ): AdapterExchangeParam {
    throw new Error('AugustusRFQOrder: getAdapterParam not implemented!');
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AugustusRFQOrderData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const isNFTOrder = !!data.makerAssetId || !!data.takerAssetId;

    const swapFunction = isNFTOrder
      ? AugustusRFQFunctions.fillOrderNFT
      : AugustusRFQFunctions.fillOrder;

    const swapFunctionParams: AugustusRFQParam = isNFTOrder
      ? [
          {
            nonceAndMeta: data.nonceAndMeta,
            expiry: data.expiry,
            makerAsset: data.makerAsset,
            makerAssetId: data.makerAssetId!,
            takerAsset: data.takerAsset,
            takerAssetId: data.takerAssetId!,
            maker: data.maker,
            taker: data.taker,
            makerAmount: data.makerAmount,
            takerAmount: data.takerAmount,
          },
          data.signature,
        ]
      : [
          {
            nonceAndMeta: data.nonceAndMeta,
            expiry: data.expiry,
            makerAsset: data.makerAsset,
            takerAsset: data.takerAsset,
            maker: data.maker,
            taker: data.taker,
            makerAmount: data.makerAmount,
            takerAmount: data.takerAmount,
          },
          data.signature,
        ];

    const swapData = this.rfqInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      AUGUSTUS_RFQ_ADDRESS[this.network],
    );
  }
}
