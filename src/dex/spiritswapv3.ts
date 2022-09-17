import { Interface, JsonFragment } from '@ethersproject/abi';
import { pack } from '@ethersproject/solidity';
import { Network, SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import UniswapV3RouterABI from '../abi/UniswapV3Router.json';
import { NumberAsString } from 'paraswap-core';
import Web3 from 'web3';

const SPIRITSWAP_V3_ROUTER_ADDRESSES: { [network: number]: Address } = {
  [Network.FANTOM]: '0x9fE77B9c31b9364cbF9A3e10Eed6c976F78B4Bc6',
};

export type SpiritswapV3Data = {
  // ExactInputSingleParams
  deadline?: number;
  path: {
    tokenIn: Address;
    tokenOut: Address;
    fee: number;
  }[];
};

type SpiritswapV3SellParam = {
  path: string;
  recipient: Address;
  deadline: number;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
};

type SpiritswapV3BuyParam = {
  path: string;
  recipient: Address;
  deadline: number;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
};

export type SpiritswapV3Param = SpiritswapV3SellParam | SpiritswapV3BuyParam;

enum SpiritswapV3Functions {
  exactInput = 'exactInput',
  exactOutput = 'exactOutput',
}

export class SpiritSwapV3
  extends SimpleExchange
  implements IDexTxBuilder<SpiritswapV3Data, SpiritswapV3Param>
{
  static dexKeys = ['spiritswapv3'];
  exchangeRouterInterface: Interface;
  needWrapNative = true;
  protected routerAddress: string;

  constructor(
    augustusAddress: Address,
    protected network: number,
    provider: Web3,
    routerAddress?: Address,
  ) {
    super(augustusAddress, provider);
    this.exchangeRouterInterface = new Interface(
      UniswapV3RouterABI as JsonFragment[],
    );
    this.routerAddress = routerAddress || SPIRITSWAP_V3_ROUTER_ADDRESSES[network];
  }

  protected encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
      fee: number;
    }[],
    side: SwapSide,
  ): string {
    if (path.length === 0) {
      return '0x';
    }

    const { _path, types } = path.reduce(
      (
        { _path, types }: { _path: string[]; types: string[] },
        curr,
        index,
      ): { _path: string[]; types: string[] } => {
        if (index === 0) {
          return {
            types: ['address', 'uint24', 'address'],
            _path: [curr.tokenIn, curr.fee.toString(), curr.tokenOut],
          };
        } else {
          return {
            types: [...types, 'uint24', 'address'],
            _path: [..._path, curr.fee.toString(), curr.tokenOut],
          };
        }
      },
      { _path: [], types: [] },
    );

    return side === SwapSide.BUY
      ? pack(types.reverse(), _path.reverse())
      : pack(types, _path);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SpiritswapV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { deadline, path: rawPath } = data;
    const path = this.encodePath(rawPath, side);
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          path: 'bytes',
          deadline: 'uint256',
        },
      },
      {
        path,
        deadline: deadline || this.getDeadline(),
      },
    );

    return {
      targetExchange: this.routerAddress,
      payload,
      networkFee: '0', // warning
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SpiritswapV3Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? SpiritswapV3Functions.exactInput
        : SpiritswapV3Functions.exactOutput;
    const path = this.encodePath(data.path, side);
    const swapFunctionParams: SpiritswapV3Param =
      side === SwapSide.SELL
        ? {
            recipient: this.augustusAddress,
            deadline: data.deadline || this.getDeadline(),
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            path,
          }
        : {
            recipient: this.augustusAddress,
            deadline: data.deadline || this.getDeadline(),
            amountOut: destAmount,
            amountInMaximum: srcAmount,
            path,
          };
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      [swapFunctionParams],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.routerAddress,
    );
  }
}
