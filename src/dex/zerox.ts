const web3Coder = require('web3-eth-abi');
import { Interface } from '@ethersproject/abi';

import * as UniswapV2AdapterABI from '../abi/UniswapV2Adapter.json';
import * as UniswapV2RouterABI from '../abi/UniswapV2ExchangeRouter.json';
import { ETHER_ADDRESS, SwapSide } from '../constants';
import { AdapterExchangeParam, Address, NumberAsString, SimpleExchangeParam, TxInfo } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';

const ZRX_EXCHANGE: any = {
  1: {
    2: '0x080bf510fcbf18b91105470639e9561022937712',
    3: '0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef',
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
  56: {
    2: '0x3F93C3D9304a70c9104642AB8cD37b1E2a7c203A',
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
};

// const ZRX_ABI: any = {
//   2: ZRX_V2_ABI,
//   3: ZRX_V3_ABI,
//   4: ZRX_V4_ABI,
// };

const ZRX_EXCHANGE_ERC20PROXY: any = {
  1: {
    1: '0x95E6F48254609A6ee006F7D493c8e5fB97094ceF',
    2: '0x95E6F48254609A6ee006F7D493c8e5fB97094ceF',
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
  56: {
    2: '0xCF21d4b7a265FF779accBA55Ace0F56C8cE6e379',
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
};

type ZeroXData = {
  minConversionRate: string;
  orders: any[];
  signatures: any[];
  networkFees?: string;
  network: number;
  version: number;
}
type ZeroXParam = {}

enum OrderStatus {
  INVALID, // Default value
  INVALID_MAKER_ASSET_AMOUNT, // Order does not have a valid maker asset amount
  INVALID_TAKER_ASSET_AMOUNT, // Order does not have a valid taker asset amount
  FILLABLE, // Order is fillable
  EXPIRED, // Order has already expired
  FULLY_FILLED, // Order is fully filled
  CANCELLED, // Order has been cancelled
}

export interface ZeroXSignedOrder {
  senderAddress: string;
  makerAddress: string;
  takerAddress: string;
  makerFee: BigInt;
  takerFee: BigInt;
  makerAssetAmount: BigInt;
  takerAssetAmount: BigInt;
  makerAssetData: string;
  takerAssetData: string;
  salt: BigInt;
  exchangeAddress: string;
  feeRecipientAddress: string;
  expirationTimeSeconds: BigInt;
  makerFeeAssetData: string;
  takerFeeAssetData: string;
  signature: string;
}

export interface ZeroXSignedOrderV4 {
  makerToken: string;
  takerToken: string;
  makerAmount: BigInt;
  takerAmount: BigInt;
  maker: string;
  taker: string;
  txOrigin: string;
  pool: string;
  expiry: BigInt;
  salt: BigInt;
}

export interface IzXSignedOrderV3 {
  exchangeAddress: string;
  makerAddress: string;
  takerAddress: string;
  feeRecipientAddress: string;
  senderAddress: string;
  makerAssetAmount: BigInt;
  takerAssetAmount: BigInt;
  makerFee: BigInt;
  takerFee: BigInt;
  expirationTimeSeconds: BigInt;
  salt: BigInt;
  makerAssetData: string;
  takerAssetData: string;
  signature: string;
  chainId: number;
  makerFeeAssetData: string;
  takerFeeAssetData: string;
}

export class ZeroXOrder  {
  static formatOrderV4(order: ZeroXSignedOrderV4, version: number) {
    return {
      makerToken: order.makerToken,
      takerToken: order.takerToken,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      maker: order.maker,
      taker: order.taker,
      txOrigin: order.txOrigin,
      pool: order.pool,
      expiry: order.expiry,
      salt: order.salt,
    };
  }

  static formatOrderV23(order: ZeroXSignedOrder, version: number) {
    const feeAssetData =
      version === 3
        ? {
          makerFeeAssetData: order.makerFeeAssetData,
          takerFeeAssetData: order.takerFeeAssetData,
        }
        : {};

    return {
      makerAddress: order.makerAddress,
      takerAddress: order.takerAddress,
      feeRecipientAddress: order.feeRecipientAddress,
      senderAddress: order.senderAddress,
      makerAssetAmount: order.makerAssetAmount,
      takerAssetAmount: order.takerAssetAmount,
      makerFee: order.makerFee,
      takerFee: order.takerFee,
      expirationTimeSeconds: order.expirationTimeSeconds,
      salt: order.salt,
      makerAssetData: order.makerAssetData,
      takerAssetData: order.takerAssetData,
      ...feeAssetData,
    };
  }

  static formatOrders(
    orders: (ZeroXSignedOrder | ZeroXSignedOrderV4)[],
    version: number = 2,
  ) {
    return version === 4
      ? orders.map(o =>
        ZeroXOrder.formatOrderV4(o as ZeroXSignedOrderV4, version),
      )
      : orders.map(o =>
        ZeroXOrder.formatOrderV23(o as ZeroXSignedOrder, version),
      );
  }
}

export class ZeroX
  extends SimpleExchange
  implements IDex<ZeroXData, ZeroXParam>
{
  routerInterface: Interface;
  adapterInterface: Interface;
  constructor(augustusAddress: Address) {
    super(augustusAddress);
    this.routerInterface = new Interface(UniswapV2RouterABI);
    this.adapterInterface = new Interface(UniswapV2AdapterABI);
  }

  getExchange(data: ZeroXData) {
    return ZRX_EXCHANGE[data.network][data.version];
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: ZeroXData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = web3Coder.encodeParameter(
      {
        ParentStruct: {
          path: 'address[]',
        },
      },
      { path },
    );
    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: ZeroXData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const swapData = this.routerInterface.encodeFunctionData(
      side === SwapSide.SELL ? 'swap' : 'buy',
      [srcAmount, destAmount, path],
    );
    return this.buildSimpleParamWithoutWETHConversion(
      src,
      srcAmount,
      dest,
      destAmount,
      swapData,
      data.router,
    );
  }

  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: ZeroXData,
    side: SwapSide,
  ): TxInfo<ZeroXParam> {
    const path = this.fixPath(data.path, srcToken, destToken);
    const encoder = (...params: ZeroXParam) =>
      this.routerInterface.encodeFunctionData(
        side === SwapSide.SELL ? 'swapOnUniswap' : 'buyOnUniswap',
        params,
      );
    return {
      params: [srcAmount, destAmount, path],
      encoder,
      networkFee: '0',
    };
  }
}
