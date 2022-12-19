import { Interface, JsonFragment } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AaveV1Data, AaveV1Param } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AaveV1Config, Adapters } from './config';
import AAVE_LENDING_POOL_ABI_V1 from '../../abi/AaveV1_lending_pool.json';
import ERC20 from '../../abi/erc20.json';
import { isAAVEPair } from './tokens';

const AaveGasCost = 400 * 1000;

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
  readonly hasConstantPriceLargeAmounts = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AaveV1Config);

  logger: Logger;
  aavePool: Interface;
  aContract: Interface;

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.aavePool = new Interface(AAVE_LENDING_POOL_ABI_V1 as JsonFragment[]);
    this.aContract = new Interface(ERC20 as JsonFragment[]);
  }

  async initializePricing(blockNumber: number) {}

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return Adapters[this.network][side];
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const aToken = isAAVEPair(this.network, srcToken, destToken);
    if (aToken === null) {
      return [];
    }
    return [`${this.dexKey}_${aToken.address}`];
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<AaveV1Data>> {
    const aToken = isAAVEPair(this.network, srcToken, destToken);
    if (!aToken) {
      return null;
    }
    const fromAToken = aToken == srcToken;
    return [
      {
        prices: amounts,
        unit: getBigIntPow(
          (side === SwapSide.SELL ? destToken : srcToken).decimals,
        ),
        gasCost: AaveGasCost,
        exchange: this.dexKey,
        data: {
          fromAToken,
          isV2: false,
        },
        poolAddresses: [fromAToken ? srcToken.address : destToken.address],
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<AaveV1Data>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      CALLDATA_GAS_COST.ADDRESS
    );
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AaveV1Data,
    side: SwapSide,
  ): AdapterExchangeParam {
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
      targetExchange: AAVE_LENDING_POOL,
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AaveV1Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const amount = side === SwapSide.SELL ? srcAmount : destAmount;
    const [Interface, swapFunction, swapFunctionParams, swapCallee, spender] =
      ((): [Interface, AaveV1Functions, AaveV1Param, Address, Address?] => {
        if (data.fromAToken) {
          return [this.aContract, AaveV1Functions.redeem, [amount], srcToken];
        }

        return [
          this.aavePool,
          AaveV1Functions.deposit,
          [srcToken, amount, REF_CODE],
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
      amount,
      destToken,
      destAmount,
      swapData,
      swapCallee,
      spender,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  updatePoolState(): Promise<void> {
    return Promise.resolve();
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }
}
