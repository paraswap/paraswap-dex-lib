import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import AaveV1ABI from '../abi/AaveV1_lending_pool.json';
import ERC20 from '../abi/erc20.json';

export type AaveV1Data = {
  fromAToken: boolean;
  isV2: boolean;
};
type AaveV1Param = [_reserve: string, _amount: string, _referralCode: number];
enum AaveV1Functions {
  deposit = 'deposit',
}

const AAVE_LENDING_POOL = '0x398eC7346DcD622eDc5ae82352F02bE94C62d119';
const AAVE_PROXY = '0x3dfd23a6c5e8bbcfc9581d2e864a68feb6a076d3';
const REF_CODE = 1;

export class AaveV1
  extends SimpleExchange
  implements IDex<AaveV1Data, AaveV1Param>
{
  protected dexKeys = ['aave'];
  aavePool: Interface;
  aContract: Interface;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.aavePool = new Interface(AaveV1ABI as JsonFragment[]);
    this.aContract = new Interface(ERC20 as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AaveV1Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (data.isV2) return;

    const aToken = data.fromAToken ? destToken : srcToken;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          aToken: 'address',
        },
      },
      { aToken },
    );

    return {
      targetExchange: srcToken, // TODO: find better generalisation, equivalent to LENDING_DEXES
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AaveV1Data,
    side: SwapSide,
  ): SimpleExchangeParam {
    if (data.isV2) return;

    if (data.fromAToken) {
      const swapData = this.aContract.encodeFunctionData('redeem', [srcAmount]);

      return this.buildSimpleParamWithoutWETHConversion(
        srcToken,
        srcAmount,
        destToken,
        destAmount,
        swapData,
        srcToken,
      );
    }

    const swapFunction = AaveV1Functions.deposit;
    const swapFunctionParams: AaveV1Param = [srcToken, srcAmount, REF_CODE];
    const swapData = this.aavePool.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      AAVE_LENDING_POOL,
      AAVE_PROXY, // Warning
    );
  }
}
