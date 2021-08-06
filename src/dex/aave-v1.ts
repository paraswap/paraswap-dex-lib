import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import AAVE_LENDING_POOL_ABI_V1 from '../abi/AaveV1_lending_pool.json';
import ERC20 from '../abi/erc20.json';

export type AaveV1Data = {
  fromAToken: boolean;
  isV2: boolean;
};
type AaveV1RedeemParams = [
  _reserve: string,
  _amount: string,
  _referralCode: number,
];
type AaveV1DepositParams = [token: string];
type AaveV1Param = AaveV1RedeemParams | AaveV1DepositParams;
enum AaveV1Functions {
  deposit = 'deposit',
  redeem = 'redeem',
}

const AAVE_LENDING_POOL = '0x398eC7346DcD622eDc5ae82352F02bE94C62d119';
const AAVE_PROXY = '0x3dfd23a6c5e8bbcfc9581d2e864a68feb6a076d3';
const REF_CODE = 1;

export class AaveV1
  extends SimpleExchange
  implements IDex<AaveV1Data, AaveV1Param>
{
  static ExchangeNames = ['aave'];
  aavePool: Interface;
  aContract: Interface;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.aavePool = new Interface(AAVE_LENDING_POOL_ABI_V1 as JsonFragment[]);
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
    //  if (data.isV2) return; // FIXME: better handling

    const aToken = data.fromAToken ? srcToken : destToken; // Warning
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
    //   if (data.isV2) return; // FIXME: better handling

    const [Interface, swapFunction, swapFunctionParams, swapCallee, spender] =
      ((): [Interface, AaveV1Functions, AaveV1Param, Address, Address?] => {
        if (data.fromAToken) {
          return [
            this.aContract,
            AaveV1Functions.redeem,
            [srcAmount],
            srcToken,
          ];
        }

        return [
          this.aavePool,
          AaveV1Functions.deposit,
          [srcToken, srcAmount, REF_CODE],
          AAVE_LENDING_POOL,
          AAVE_PROXY, // warning
        ];
      })();

    const swapData = Interface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      swapCallee,
      spender,
    );
  }
}
