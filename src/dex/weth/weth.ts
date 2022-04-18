import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network, BIs } from '../../constants';
import {
  getDexKeysWithNetwork,
  isETHAddress,
  WethMap,
  isWETH,
} from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  WethData,
  WethFunctions,
  DexParams,
  IWethDepositorWithdrawer,
  DepositWithdrawReturn,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, WethConfig } from './config';

export class Weth
  extends SimpleExchange
  implements IDex<WethData, DexParams>, IWethDepositorWithdrawer
{
  readonly hasConstantPriceLargeAmounts = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(WethConfig);

  public static getAddress(network: number = 1): Address {
    return WethMap[network];
  }

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected unitPrice = BIs.POWS[18],
    protected poolGasCost = WethConfig[dexKey][network].poolGasCost,
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] || null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (
      isETHAddress(srcToken.address) &&
      isWETH(destToken.address, this.network)
    ) {
      return [`${this.network}_${destToken.address}`];
    } else if (
      isWETH(srcToken.address, this.network) &&
      isETHAddress(destToken.address)
    ) {
      return [`${this.network}_${srcToken.address}`];
    } else {
      return [];
    }
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<WethData>> {
    const isWETHSwap =
      (isETHAddress(srcToken.address) &&
        isWETH(destToken.address, this.network)) ||
      (isWETH(srcToken.address, this.network) &&
        isETHAddress(destToken.address));

    if (!isWETHSwap) return null;

    return [
      {
        prices: amounts,
        unit: this.unitPrice,
        gasCost: this.poolGasCost,
        exchange: this.dexKey,
        poolAddresses: [Weth.getAddress(this.network)],
        data: null,
      },
    ];
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WethData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: Weth.getAddress(this.network),
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WethData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapData = isETHAddress(srcToken)
      ? this.erc20Interface.encodeFunctionData(WethFunctions.deposit)
      : this.erc20Interface.encodeFunctionData(WethFunctions.withdraw, [
          srcAmount,
        ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      Weth.getAddress(this.network),
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }

  getDepositWithdrawParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    side: SwapSide,
  ): DepositWithdrawReturn | undefined {
    const wethToken = Weth.getAddress(this.network);

    if (srcAmount !== '0' && isETHAddress(srcToken)) {
      const opType = WethFunctions.deposit;
      const depositWethData = this.erc20Interface.encodeFunctionData(opType);

      return {
        opType,
        callee: wethToken,
        calldata: depositWethData,
        value: srcAmount,
      };
    }

    if (destAmount !== '0' && isETHAddress(destToken)) {
      const opType = WethFunctions.withdrawAllWETH;
      const withdrawWethData = this.simpleSwapHelper.encodeFunctionData(
        opType,
        [wethToken],
      );

      return {
        opType,
        callee: this.augustusAddress,
        calldata: withdrawWethData,
        value: '0',
      };
    }
  }
}
