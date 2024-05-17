import { Interface, JsonFragment } from '@ethersproject/abi';
import { NumberAsString, SwapSide } from '@paraswap/core';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  Logger,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
  TransferFeeParams,
} from '../../types';
import { IDex } from '../idex';
import DIVETH_ABI from '../../abi/divETH.json';
import WDIVETH_ABI from '../../abi/wdivETH.json';
import { ETHER_ADDRESS, Network, NULL_ADDRESS } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { SimpleExchange } from '../simple-exchange';
import { AsyncOrSync } from 'ts-essentials';
import { getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { WethFunctions } from '../weth/types';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import _ from 'lodash';
import { DivaConfig, Adapters } from './config';
import { DivETHEventPool } from './diveth-pool';
import { BI_POWS } from '../../bigint-constants';

export type SwellData = {};
export type SwellParams = {};

export class Diva
  extends SimpleExchange
  implements IDex<SwellData, SwellParams>
{
  static dexKeys = ['Diva'];
  divETHAddress: string;
  wdivETHAddress: string;
  divETHInterface: Interface;
  wdivETHInterface: Interface;
  needWrapNative = false;
  hasConstantPriceLargeAmounts: boolean = false;
  divETHEventPool: DivETHEventPool;
  logger: Logger;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(DivaConfig, ['Diva']));

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected config = DivaConfig[dexKey][network],
    protected adapters = Adapters[network],
  ) {
    super(dexHelper, dexKey);

    this.network = dexHelper.config.data.network;
    this.divETHInterface = new Interface(DIVETH_ABI as JsonFragment[]);
    this.wdivETHInterface = new Interface(WDIVETH_ABI as JsonFragment[]);
    this.divETHAddress = this.config.divETH.toLowerCase();
    this.wdivETHAddress = this.config.wdivETH.toLowerCase();
    this.logger = dexHelper.getLogger(this.dexKey);
    this.divETHEventPool = new DivETHEventPool(
      this.dexKey,
      dexHelper,
      this.divETHAddress,
      this.divETHInterface,
      this.logger,
    );
  }

  async initializePricing(blockNumber: number) {
    await this.divETHEventPool.initialize(blockNumber);
  }

  isEligibleSwap(
    srcToken: Token | string,
    destToken: Token | string,
    side: SwapSide,
  ): boolean {
    if (side === SwapSide.BUY) return false;

    const srcTokenAddress = (
      typeof srcToken === 'string' ? srcToken : srcToken.address
    ).toLowerCase();
    const destTokenAddress = (
      typeof destToken === 'string' ? destToken : destToken.address
    ).toLowerCase();

    return (
      (isETHAddress(srcTokenAddress) || this.isWETH(srcTokenAddress)) &&
      destTokenAddress === this.divETHAddress
    );
  }

  assertEligibility(
    srcToken: Token | string,
    destToken: Token | string,
    side: SwapSide,
  ) {
    if (!this.isEligibleSwap(srcToken, destToken, side)) {
      throw new Error('Only ETH/wETH -> divETH/wdivETH and divETH <-> wdivETH swaps are supported');
    }
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if(!this.isEligibleSwap(srcToken, destToken, side)) return [];

    return [`${ETHER_ADDRESS}_${destToken}`.toLowerCase()];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amountsIn: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[] | undefined,
    transferFees?: TransferFeeParams | undefined,
    isFirstSwap?: boolean | undefined,
  ): Promise<ExchangePrices<SwellData> | null> {
    if (!this.isEligibleSwap(srcToken, destToken, side)) return null;
    if (this.divETHEventPool.getState(blockNumber) === null) return null;

    const unitIn = BI_POWS[18];
    const unitOut = this.divETHEventPool.convertToShares(blockNumber, unitIn);
    const amountsOut = amountsIn.map(amountIn =>
      this.divETHEventPool.convertToShares(blockNumber, amountIn),
    );

    return [
      {
        prices: amountsOut,
        unit: unitOut,
        data: {},
        exchange: this.dexKey,
        poolIdentifier: `${ETHER_ADDRESS}_${destToken.address}`.toLowerCase(),
        gasCost: 120_000,
        poolAddresses: [destToken.address],
      },
    ];
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: SwellData,
    side: SwapSide,
  ): AdapterExchangeParam {
    this.assertEligibility(srcToken, destToken, side);

    return {
      targetExchange: NULL_ADDRESS,
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: SwellData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    this.assertEligibility(srcToken, destToken, side);

    const callees = [];
    const calldata = [];
    const values = [];

    if (this.isWETH(srcToken)) {
      // note: ERC20 ABI contains wETH functions
      const wethUnwrapData = this.erc20Interface.encodeFunctionData(
        WethFunctions.withdraw,
        [srcAmount],
      );
      callees.push(this.dexHelper.config.data.wrappedNativeTokenAddress);
      calldata.push(wethUnwrapData);
      values.push('0');
    }

    const swapData = this.divETHInterface.encodeFunctionData(
      'deposit',
      [],
    );

    callees.push(this.divETHAddress);
    calldata.push(swapData);
    values.push(srcAmount);

    return {
      callees,
      calldata,
      values,
      networkFee: '0',
    };
  }

  getCalldataGasCost(poolPrices: PoolPrices<SwellData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_OVERHEAD + CALLDATA_GAS_COST.LENGTH_SMALL;
  }
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters?.[side] || null;
  }
  getTopPoolsForToken(
    tokenAddress: string,
    limit: number,
  ): AsyncOrSync<PoolLiquidity[]> {
    return [];
  }
}
