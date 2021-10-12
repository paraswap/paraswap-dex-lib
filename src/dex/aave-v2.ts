import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SwapSide, NULL_ADDRESS } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import AAVE_LENDING_POOL_ABI_V2 from '../abi/AaveV2_lending_pool.json';
import WETH_GATEWAY_ABI_1 from '../abi/aave-weth-gateway.json';
import WETH_GATEWAY_ABI_137 from '../abi/aave-weth-gateway-137.json';
import WETH_GATEWAY_ABI_43114 from '../abi/aave-weth-gateway-43114.json';
import { isETHAddress } from '../utils';

export type AaveV2Data = {
  fromAToken: boolean;
  isV2: boolean;
};
type AaveV2DepositETHParams_1 = [onBehalfOf: string, referralCode: number];
type AaveV2DepositETHParams_137 = [
  lendingPool: string,
  onBehalfOf: string,
  referralCode: number,
];
type AaveV2WithdrawETHParams_1 = [amount: string, to: string];
type AaveV2WithdrawETHParams_137 = [
  lendingPool: string,
  amount: string,
  to: string,
];
type AaveV2Deposit = [
  asset: string,
  amount: string,
  onBehalfOf: string,
  referralCode: number,
];
type AaveV2Withdraw = [asset: string, amount: string, to: string];

type AaveV2Param =
  | AaveV2DepositETHParams_1
  | AaveV2DepositETHParams_137
  | AaveV2WithdrawETHParams_1
  | AaveV2WithdrawETHParams_137
  | AaveV2Deposit
  | AaveV2Withdraw;

enum AaveV2PoolAndWethFunctions {
  withdraw = 'withdraw',
  withdrawETH = 'withdrawETH',
  deposit = 'deposit',
  depositETH = 'depositETH',
}

const aaveLendingPool: { [network: string]: string } = {
  1: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
  137: '0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf',
  43114: '0x4F01AeD16D97E3aB5ab2B501154DC9bb0F1A5A2C',
};

const WETH_GATEWAY: any = {
  1: '0xDcD33426BA191383f1c9B431A342498fdac73488',
  137: '0xbEadf48d62aCC944a06EEaE0A9054A90E5A7dc97',
  43114: '0x8a47F74d1eE0e2edEB4F3A7e64EF3bD8e11D27C8',
};

const WETH_GATEWAY_ABI: any = {
  1: WETH_GATEWAY_ABI_1,
  137: WETH_GATEWAY_ABI_137,
  43114: WETH_GATEWAY_ABI_43114,
};

const REF_CODE = 1;

export class AaveV2
  extends SimpleExchange
  implements IDex<AaveV2Data, AaveV2Param>
{
  static dexKeys = ['aave2'];
  aavePool: Interface;
  wethGateway: Interface;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
    this.aavePool = new Interface(AAVE_LENDING_POOL_ABI_V2 as JsonFragment[]);
    this.wethGateway = new Interface(
      WETH_GATEWAY_ABI[network] as JsonFragment[],
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AaveV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const aToken = data.fromAToken ? srcToken : destToken; // Warning
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          aToken: 'address',
        },
      },
      { aToken: aToken },
    );

    return {
      // target exchange is not used by the contract
      targetExchange: NULL_ADDRESS,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AaveV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const [Interface, swapCallee, swapFunction, swapFunctionParams] = ((): [
      Interface,
      Address,
      AaveV2PoolAndWethFunctions,
      AaveV2Param,
    ] => {
      if (isETHAddress(srcToken)) {
        switch (this.network) {
          case 1:
            return [
              this.wethGateway,
              WETH_GATEWAY[this.network],
              AaveV2PoolAndWethFunctions.depositETH,
              [this.augustusAddress, REF_CODE],
            ];
          case 137:
            return [
              this.wethGateway,
              WETH_GATEWAY[this.network],
              AaveV2PoolAndWethFunctions.depositETH,
              [aaveLendingPool[this.network], this.augustusAddress, REF_CODE],
            ];
          case 43114:
            return [
              this.wethGateway,
              WETH_GATEWAY[this.network],
              AaveV2PoolAndWethFunctions.depositETH,
              [aaveLendingPool[this.network], this.augustusAddress, REF_CODE],
            ];
          default:
            throw new Error(`Network ${this.network} not supported`);
        }
      }

      if (isETHAddress(destToken)) {
        switch (this.network) {
          case 1:
            return [
              this.wethGateway,
              WETH_GATEWAY[this.network],
              AaveV2PoolAndWethFunctions.withdrawETH,
              [srcAmount, this.augustusAddress],
            ];
          case 137:
            return [
              this.wethGateway,
              WETH_GATEWAY[this.network],
              AaveV2PoolAndWethFunctions.withdrawETH,
              [aaveLendingPool[this.network], srcAmount, this.augustusAddress],
            ];
          case 43114:
            return [
              this.wethGateway,
              WETH_GATEWAY[this.network],
              AaveV2PoolAndWethFunctions.withdrawETH,
              [aaveLendingPool[this.network], srcAmount, this.augustusAddress],
            ];
          default:
            throw new Error(`Network ${this.network} not supported`);
        }
      }

      if (data.fromAToken) {
        return [
          this.aavePool,
          aaveLendingPool[this.network],
          AaveV2PoolAndWethFunctions.withdraw,
          [destToken, srcAmount, this.augustusAddress],
        ];
      }

      return [
        this.aavePool,
        aaveLendingPool[this.network],
        AaveV2PoolAndWethFunctions.deposit,
        [srcToken, srcAmount, this.augustusAddress, REF_CODE],
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
    );
  }
}
