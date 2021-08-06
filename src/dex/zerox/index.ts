import { AbiEncoder } from '@0x/utils';
import { Interface } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';

import ERC20ABI from '../../abi/erc20.json';
import IParaswapAbi from '../../abi/IParaswap.json';
import ZRX_V2_ABI from '../../abi/zrx.v2.json';
import ZRX_V3_ABI from '../../abi/zrx.v3.json';
import ZRX_V4_ABI from '../../abi/zrx.v4.json';

import { ETHER_ADDRESS, SwapSide } from '../../constants';
import { SimpleExchange } from '../simple-exchange';
import { Weth } from '../weth';
import { ZeroXOrder } from './order';

import type { IDex } from '../idex';
import type {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
  TxInfo,
} from '../../types';
import type { ZeroXSignedOrder, ZeroXSignedOrderV2 } from './types';

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

const ZRX_ABI: any = {
  2: ZRX_V2_ABI,
  3: ZRX_V3_ABI,
  4: ZRX_V4_ABI,
};

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
  order: ZeroXSignedOrder;
  signatures: any[];
  networkFees?: string;
  version: number;
  router: string;
};

type SwapOnZeroXParam = [
  Address, // srcToken
  Address, // destToken
  NumberAsString, // srcAmount
  NumberAsString, // destAmount
  Address, // exchange
  ZeroXSignedOrder, // payload
];

type BuyOnZeroXParam = [
  Address, // srcToken
  Address, // destToken
  NumberAsString, // srcAmount
  NumberAsString, // destAmount
  Address, // exchange
  ZeroXSignedOrder, // payload
];

type ZeroXParam = SwapOnZeroXParam | BuyOnZeroXParam;

export class ZeroX
  extends SimpleExchange
  implements IDex<ZeroXData, ZeroXParam>
{
  routerInterface: Interface;
  erc20Interface: Interface;
  ExchangeNames = ['zerox'];
  needWrapNative = true;

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress);
    this.routerInterface = new Interface(IParaswapAbi);
    this.erc20Interface = new Interface(ERC20ABI);
  }

  private getExchange(data: ZeroXData) {
    return ZRX_EXCHANGE[this.network][data.version];
  }

  protected buildSwapData(data: ZeroXData, srcAmount: NumberAsString) {
    const zrxABI = ZRX_ABI[data.version];
    const orders = ZeroXOrder.formatOrders(data.order, data.version);
    const signatures = data.signatures;

    const methodAbi = zrxABI.find(
      (m: any) =>
        m.name ===
        (data.version === 4 ? 'fillRfqOrder' : 'marketSellOrdersNoThrow'),
    );

    const abiEncoder = new AbiEncoder.Method(methodAbi);
    // TODO: fillLimitOrder only accepts one order, find something that can accept multiple orders
    return abiEncoder.encode(
      data.version === 4
        ? [orders, signatures[0], srcAmount]
        : [orders, srcAmount, signatures],
    );
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: ZeroXData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload =
      data.version === 4
        ? this.abiCoder.encodeParameter(
            {
              ParentStruct: {
                order: {
                  makerToken: 'address',
                  takerToken: 'address',
                  makerAmount: 'uint128',
                  takerAmount: 'uint128',
                  maker: 'address',
                  taker: 'address',
                  txOrigin: 'address',
                  pool: 'bytes32',
                  expiry: 'uint64',
                  salt: 'uint256',
                },
                signature: {
                  signatureType: 'uint8',
                  v: 'uint8',
                  r: 'bytes32',
                  s: 'bytes32',
                },
              },
            },
            {
              order: ZeroXOrder.formatOrders(data.order, 4),
              signature: data.signatures[0], //TODO check this one
            },
          )
        : this.abiCoder.encodeParameter(
            {
              ParentStruct: {
                'orders[]': {
                  makerAddress: 'address', // Address that created the order.
                  takerAddress: 'address', // Address that is allowed to fill the order. If set to 0, any address is allowed to fill the order.
                  feeRecipientAddress: 'address', // Address that will recieve fees when order is filled.
                  senderAddress: 'address', // Address that is allowed to call Exchange contract methods that affect this order. If set to 0, any address is allowed to call these methods.
                  makerAssetAmount: 'uint256', // Amount of makerAsset being offered by maker. Must be greater than 0.
                  takerAssetAmount: 'uint256', // Amount of takerAsset being bid on by maker. Must be greater than 0.
                  makerFee: 'uint256', // Fee paid to feeRecipient by maker when order is filled.
                  takerFee: 'uint256', // Fee paid to feeRecipient by taker when order is filled.
                  expirationTimeSeconds: 'uint256', // Timestamp in seconds at which order expires.
                  salt: 'uint256', // Arbitrary number to facilitate uniqueness of the order's hash.
                  makerAssetData: 'bytes', // Encoded data that can be decoded by a specified proxy contract when transferring makerAsset. The leading bytes4 references the id of the asset proxy.
                  takerAssetData: 'bytes',
                },
                signatures: 'bytes[]',
              },
            },
            {
              orders: ZeroXOrder.formatOrders(data.order, 2),
              signatures: (data.order as ZeroXSignedOrderV2).signature,
            },
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
    const swapData = this.buildSwapData(data, srcAmount);
    const networkFees = data.networkFees || '0';

    return this.buildSimpleParamWithoutWETHConversion(
      src, // WARNING: WETH instead ? what about other cases
      srcAmount,
      dest,
      destAmount,
      swapData,
      this.getExchange(data),
      ZRX_EXCHANGE_ERC20PROXY[this.network][data.version],
      networkFees,
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
    const encoder = (...params: ZeroXParam) => {
      switch (data.version) {
        case 2:
          return this.routerInterface.encodeFunctionData(
            'swapOnZeroXv2', // TODO Buy case
            params,
          );
        case 4:
          return this.routerInterface.encodeFunctionData(
            'swapOnZeroXv4', // TODO Buy case
            params,
          );
        default:
          throw new Error(`ZeroX version ${data.version} is not supported!`);
      }
    };
    return {
      params: [
        srcToken,
        destToken,
        srcAmount,
        destAmount,
        this.getExchange(data),
        data.order,
      ], // TODO wait for adjustment in SC
      encoder,
      networkFee: '0',
    };
  }
}
