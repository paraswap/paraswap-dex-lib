import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
  SwapSide,
  MAX_UINT,
  MAX_INT,
  MIN_INT,
  ETHER_ADDRESS,
  NULL_ADDRESS,
} from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import BalancerV2Abi from '../abi/BalancerV2.json';
import { isETHAddress } from '../utils';

type BalancerSwapsV2 = {
  poolId: string;
  amount: string;
}[];

const VaultAddress: { [chainId: number]: string } = {
  1: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  5: '0x65748E8287Ce4B9E6D83EE853431958851550311',
  42: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  137: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  42161: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
};

type BalancerV2Data = {
  swaps: BalancerSwapsV2;
};

type BalancerFunds = {
  sender: string;
  recipient: string;
  fromInternalBalance: boolean;
  toInternalBalance: boolean;
};

// Indexes represent the index of the asset assets array param
type BalancerSwap = {
  poolId: string;
  assetInIndex: number;
  assetOutIndex: number;
  amount: string;
  userData: string;
};

enum SwapTypes {
  SwapExactIn,
  SwapExactOut,
}

type BalancerParam = [
  kind: SwapTypes,
  swaps: BalancerSwap[],
  assets: string[],
  funds: BalancerFunds,
  limits: string[],
  deadline: string,
];

export class BalancerV2
  extends SimpleExchange
  implements IDex<BalancerV2Data, BalancerParam>
{
  static dexKeys = ['balancerv2'];
  vaultInterface: Interface;
  vaultAddress: string;

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
    this.vaultInterface = new Interface(BalancerV2Abi as JsonFragment[]);
    this.vaultAddress = VaultAddress[network];
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BalancerV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const params = this.getBalancerParam(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data,
      side,
    );

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          'swaps[]': {
            poolId: 'bytes32',
            assetInIndex: 'uint256',
            assetOutIndex: 'uint256',
            amount: 'uint256',
            userData: 'bytes',
          },
          assets: 'address[]',
          funds: {
            sender: 'address',
            fromInternalBalance: 'bool',
            recipient: 'address',
            toInternalBalance: 'bool',
          },
          limits: 'int256[]',
          deadline: 'uint256',
        },
      },
      {
        swaps: params[1],
        assets: params[2],
        funds: params[3],
        limits: params[4],
        deadline: params[5],
      },
    );

    return {
      targetExchange: this.vaultAddress,
      payload,
      networkFee: '0',
    };
  }

  private getBalancerParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BalancerV2Data,
    side: SwapSide,
  ): BalancerParam {
    // BalancerV2 Uses Address(0) as ETH
    const assets = [srcToken, destToken].map(t =>
      t.toLowerCase() === ETHER_ADDRESS.toLowerCase() ? NULL_ADDRESS : t,
    );

    const swaps = data.swaps.map(s => ({
      poolId: s.poolId,
      assetInIndex: 0,
      assetOutIndex: 1,
      amount: s.amount,
      userData: '0x',
    }));

    const funds = {
      sender: this.augustusAddress,
      recipient: this.augustusAddress,
      fromInternalBalance: false,
      toInternalBalance: false,
    };

    const limits = [MAX_INT, MAX_INT];

    const params: BalancerParam = [
      side === SwapSide.SELL ? SwapTypes.SwapExactIn : SwapTypes.SwapExactOut,
      swaps,
      assets,
      funds,
      limits,
      MAX_UINT,
    ];

    return params;
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BalancerV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const params = this.getBalancerParam(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data,
      side,
    );

    const swapData = this.vaultInterface.encodeFunctionData(
      'batchSwap',
      params,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.vaultAddress,
    );
  }
}
