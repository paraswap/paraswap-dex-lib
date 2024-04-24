import { Interface, JsonFragment } from '@ethersproject/abi';
import { NULL_ADDRESS, SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import eETHPoolABI from '../abi/etherfi/eETHPool.json';
import weETHABI from '../abi/etherfi/weETH.json';
import { IDexHelper } from '../dex-helper';
import { isETHAddress } from '../utils';
import { assert } from 'ts-essentials';
import { WethFunctions } from './weth/types';

type EtherFiData = void;

type eETHPoolDepositParam = [];
type weETHWrap = [_eETHAmount: string];
type weETHUnwrap = [_weETHAmount: string];

type EtherFiParam = eETHPoolDepositParam | weETHWrap | weETHUnwrap;

enum EtherFiFunctions {
  deposit = 'deposit',
  wrap = 'wrap',
  unwrap = 'unwrap',
}

const EtherFiConfig: Record<
  number,
  { eETH: string; eETHPool: string; weETH: string }
> = {
  1: {
    eETH: '0x35fa164735182de50811e8e2e824cfb9b6118ac2',
    eETHPool: '0x308861a430be4cce5502d0a12724771fc6daf216',
    weETH: '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee',
  },
};

export class EtherFi
  extends SimpleExchange
  implements IDexTxBuilder<EtherFiData, EtherFiParam>
{
  static dexKeys = ['etherfi'];

  eETHPoolInterface: Interface;
  weETHInterface: Interface;
  needWrapNative = false;

  eETH: string;
  eETHPool: string;
  weETH: string;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'etherfi');

    this.eETHPoolInterface = new Interface(eETHPoolABI as JsonFragment[]);
    this.weETHInterface = new Interface(weETHABI as JsonFragment[]);

    this.eETH = EtherFiConfig[this.network].eETH.toLowerCase();
    this.eETHPool = EtherFiConfig[this.network].eETHPool.toLowerCase();
    this.weETH = EtherFiConfig[this.network].weETH.toLowerCase();
  }

  is_eETH = (token: string) => token.toLowerCase() === this.eETH;
  is_weETH = (token: string) => token.toLowerCase() === this.weETH;

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: EtherFiData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const callees = [];
    const calldata = [];
    const values = [];

    // if token is wETH need to withdraw first
    if (this.isWETH(srcToken)) {
      const wethUnwrapData = this.erc20Interface.encodeFunctionData(
        WethFunctions.withdraw,
        [srcAmount],
      );
      callees.push(this.dexHelper.config.data.wrappedNativeTokenAddress);
      calldata.push(wethUnwrapData);
      values.push('0');
    }

    const [Interface, swapCallee, swapFunction, swapFunctionParams] = ((): [
      Interface,
      Address,
      EtherFiFunctions,
      EtherFiParam,
    ] => {
      if (this.is_weETH(destToken)) {
        assert(this.is_eETH(srcToken), 'srcToken should be eETH');
        return [
          this.weETHInterface,
          this.weETH,
          EtherFiFunctions.wrap,
          [srcAmount],
        ];
      }

      if (this.is_weETH(srcToken)) {
        assert(this.is_eETH(destToken), 'destToken should be eETH');
        return [
          this.weETHInterface,
          this.weETH,
          EtherFiFunctions.unwrap,
          [srcAmount],
        ];
      }

      if (this.is_eETH(destToken)) {
        assert(
          this.isWETH(srcToken) || isETHAddress(srcToken),
          'srcToken should be (w)eth',
        );
        return [
          this.eETHPoolInterface,
          this.eETHPool,
          EtherFiFunctions.deposit,
          [],
        ];
      }

      throw new Error('LOGIC ERROR');
    })();

    const swapData = Interface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    callees.push(swapCallee);
    calldata.push(swapData);
    values.push(srcAmount);

    return {
      callees,
      calldata,
      values,
      networkFee: '0',
    };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: EtherFiData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: NULL_ADDRESS,
      payload: '0x',
      networkFee: '0',
    };
  }
}
