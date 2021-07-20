const web3Coder = require('web3-eth-abi');
import { Interface } from '@ethersproject/abi';
import { AbiEncoder } from '@0x/utils';

import ZRX_V2_ABI = require('../../abi/zrx.v2.json');
import ZRX_V3_ABI = require('../../abi/zrx.v3.json');
import ZRX_V4_ABI = require('../../abi/zrx.v4.json');

import { SwapSide } from '../../constants';
import { AdapterExchangeParam, Address, NumberAsString, SimpleExchangeParam, TxInfo } from '../../types';
import { IDex } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import { ZeroXOrder } from './order';

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
  orders: any[];
  signatures: any[];
  networkFees?: string;
  network: number;
  version: number;
  router: string;
}
type ZeroXParam = {}

export class ZeroX
  extends SimpleExchange
  implements IDex<ZeroXData, ZeroXParam>
{
  constructor(augustusAddress: Address) {
    super(augustusAddress);
  }

  getExchange(data: ZeroXData) {
    return ZRX_EXCHANGE[data.network][data.version];
  }

  buildSwapData(data: ZeroXData, srcAmount: NumberAsString) {
    const zrxABI = ZRX_ABI[data.version];
    const orders = ZeroXOrder.formatOrders(data.orders, data.version);
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
        ? [orders[0], signatures[0], srcAmount]
        : [orders, srcAmount, signatures],
    );
  }

  private async getTokenToTokenSwapData(srcToken: Address, srcAmount: NumberAsString, data: ZeroXData) {
    const approveCallData = await this.getApproveSimpleParam(
      srcToken,
      ZRX_EXCHANGE_ERC20PROXY[data.network][data.version],
      srcAmount,
    );

    const assetSwapperData = this.buildSwapData(data, srcAmount);

    const networkFees = data.networkFees || '0';

    const callees = approveCallData
      ? [this.augustusAddress, this.getExchange(data)]
      : [this.getExchange(data)];
    const calldata = approveCallData
      ? [...approveCallData.calldata, assetSwapperData]
      : [assetSwapperData];
    const values = approveCallData ? ['0', networkFees] : [networkFees];

    return {
      callees,
      calldata,
      values,
    };
  }

  protected async ethToTokenSwap(
    srcToken: Address,
    destToken: Address,
    data: ZeroXData,
  ): Promise<SimpleExchangeParam> {
    const wethToken = Weth.getAddress(data.network);
    const wethContract = new this.web3Provider.eth.Contract(
      ERC20_ABI,
      wethToken,
    );
    const depositWethData = wethContract.methods.deposit().encodeABI();

    const wethToTokenData = await this.getTokenToTokenSwapData(wethToken, data);

    return {
      callees: [wethToken, ...wethToTokenData.callees],
      calldata: [depositWethData, ...wethToTokenData.calldata],
      values: [data.srcAmount, ...wethToTokenData.values],
    };
  }

  protected async tokenToEthSwap(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    data: ZeroXData,
  ): Promise<SimpleExchangeParam> {
    const wethToken = Weth.getAddress(data.network);
    const wethToTokenData = await this.getTokenToTokenSwapData(srcToken, srcAmount, data);
    const withdrawWethData = this.simpleSwapHelper.encodeFunctionData('withdrawAllWETH', [wethToken])

    return {
      callees: [...wethToTokenData.callees, this.augustusAddress],
      calldata: [...wethToTokenData.calldata, withdrawWethData],
      values: [...wethToTokenData.values, '0'],
    };
  }

  protected async tokenToTokenSwap(
    srcToken: Address,
    destToken: Address,
    data: ZeroXData,
  ): Promise<SimpleExchangeParam> {
    const swapData = await this.getTokenToTokenSwapData(srcToken, data);

    return {
      callees: [...swapData.callees],
      calldata: [...swapData.calldata],
      values: [...swapData.values],
    };
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: ZeroXData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = data.version === 4
      ? web3Coder.encodeParameter(
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
          order: ZeroXOrder.formatOrders(data.orders, 4)[0],
          signature: data.orders[0].signature,
        },
      )
      : web3Coder.encodeParameter(
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
          orders: ZeroXOrder.formatOrders(data.orders),
          signatures: data.orders.map((o: any) => o.signature),
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
    // const swapData = this.routerInterface.encodeFunctionData(
    //   side === SwapSide.SELL ? 'swap' : 'buy',
    //   [srcAmount, destAmount, path],
    // );
    // return this.buildSimpleParamWithoutWETHConversion(
    //   src,
    //   srcAmount,
    //   dest,
    //   destAmount,
    //   swapData,
    //   data.router,
    // );
  }

  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: ZeroXData,
    side: SwapSide,
  ): TxInfo<ZeroXParam> {
    // const path = this.fixPath(data.path, srcToken, destToken);
    // const encoder = (...params: ZeroXParam) =>
    //   this.routerInterface.encodeFunctionData(
    //     side === SwapSide.SELL ? 'swapOnUniswap' : 'buyOnUniswap',
    //     params,
    //   );
    // return {
    //   params: [srcAmount, destAmount, path],
    //   encoder,
    //   networkFee: '0',
    // };
  }
}
