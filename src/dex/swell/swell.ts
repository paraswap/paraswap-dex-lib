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
import SWETH_ABI from '../../abi/swETH.json';
import RSWETH_ABI from '../../abi/rswETH.json';
import { ETHER_ADDRESS, Network, NULL_ADDRESS } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { SimpleExchange } from '../simple-exchange';
import { BI_POWS } from '../../bigint-constants';
import { AsyncOrSync } from 'ts-essentials';
import { getOnChainStateRswETH, getOnChainStateSwETH } from './utils';
import { SwethPool } from './sweth-pool';
import { getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { WethFunctions } from '../weth/types';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import _ from 'lodash';
import { SwellConfig, Adapters } from './config';
import { RswethPool } from './rsweth-pool';

export enum swETHFunctions {
  deposit = 'deposit',
}
export enum rswETHFunctions {
  deposit = 'deposit',
}

export type SwellData = {};
export type SwellParams = {};

export class Swell
  extends SimpleExchange
  implements IDex<SwellData, SwellParams>
{
  static dexKeys = ['Swell'];
  swETHInterface: Interface;
  rswETHInterface: Interface;
  needWrapNative = false;
  hasConstantPriceLargeAmounts: boolean = true;
  swETHAddress: string;
  rswETHAddress: string;
  swethPool: SwethPool;
  rswethPool: RswethPool;
  logger: Logger;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SwellConfig, ['Swell']));

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected config = SwellConfig[dexKey][network],
    protected adapters = Adapters[network],
  ) {
    super(dexHelper, 'Swell');

    this.network = dexHelper.config.data.network;
    this.swETHInterface = new Interface(SWETH_ABI as JsonFragment[]);
    this.rswETHInterface = new Interface(RSWETH_ABI as JsonFragment[]);
    this.swETHAddress = this.config.swETH.toLowerCase();
    this.rswETHAddress = this.config.rswETH.toLowerCase();
    this.logger = dexHelper.getLogger(this.dexKey);
    this.swethPool = new SwethPool(
      this.dexKey,
      dexHelper,
      this.swETHAddress,
      this.swETHInterface,
      this.logger,
    );
    this.rswethPool = new RswethPool(
      this.dexKey,
      dexHelper,
      this.rswETHAddress,
      this.rswETHInterface,
      this.logger,
    );
  }

  async initializePricing(blockNumber: number) {
    const swethPoolState = await getOnChainStateSwETH(
      this.dexHelper.multiContract,
      this.swETHAddress,
      this.swETHInterface,
      blockNumber,
    );
    const rswethPoolState = await getOnChainStateRswETH(
      this.dexHelper.multiContract,
      this.rswETHAddress,
      this.rswETHInterface,
      blockNumber,
    );

    await this.swethPool.initialize(blockNumber, {
      state: swethPoolState,
    });
    await this.rswethPool.initialize(blockNumber, {
      state: rswethPoolState,
    });
  }

  getPoolIdentifierKeySwETH(): string {
    return `${ETHER_ADDRESS}_${this.swETHAddress}`.toLowerCase();
  }
  getPoolIdentifierKeyRswETH(): string {
    return `${ETHER_ADDRESS}_${this.rswETHAddress}`.toLowerCase();
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
      (destTokenAddress === this.swETHAddress ||
        destTokenAddress === this.rswETHAddress)
    );
  }

  assertEligibility(
    srcToken: Token | string,
    destToken: Token | string,
    side: SwapSide,
  ) {
    if (!this.isEligibleSwap(srcToken, destToken, side)) {
      throw new Error(
        'Only eth/weth -> swETH or eth/weth -> rswETH swaps are supported',
      );
    }
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!this.isEligibleSwap(srcToken, destToken, side)) return [];
    if (destToken.address === this.swETHAddress) {
      return [this.getPoolIdentifierKeySwETH()];
    } else {
      return [this.getPoolIdentifierKeyRswETH()];
    }
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

    if (destToken.address === this.swETHAddress) {
      return this.pricesVolumeSwETH(amountsIn, blockNumber);
    } else {
      return this.pricesVolumeRswETH(amountsIn, blockNumber);
    }
  }

  private pricesVolumeSwETH(
    amountsIn: bigint[],
    blockNumber: number,
  ): ExchangePrices<SwellData> | null {
    if (this.swethPool.getState(blockNumber) === null) return null;
    const unitIn = BI_POWS[18];
    const unitOut = this.swethPool.getPrice(blockNumber, unitIn);
    const amountsOut = amountsIn.map(amountIn =>
      this.swethPool.getPrice(blockNumber, amountIn),
    );

    return [
      {
        prices: amountsOut,
        unit: unitOut,
        data: {},
        exchange: this.dexKey,
        poolIdentifier: this.getPoolIdentifierKeySwETH(),
        gasCost: 120_000,
        poolAddresses: [this.swETHAddress],
      },
    ];
  }

  private pricesVolumeRswETH(
    amountsIn: bigint[],
    blockNumber: number,
  ): ExchangePrices<SwellData> | null {
    if (this.rswethPool.getState(blockNumber) === null) return null;
    const unitIn = BI_POWS[18];
    const unitOut = this.rswethPool.getPrice(blockNumber, unitIn);
    const amountsOut = amountsIn.map(amountIn =>
      this.rswethPool.getPrice(blockNumber, amountIn),
    );

    return [
      {
        prices: amountsOut,
        unit: unitOut,
        data: {},
        exchange: this.dexKey,
        poolIdentifier: this.getPoolIdentifierKeyRswETH(),
        gasCost: 120_000,
        poolAddresses: [this.rswETHAddress],
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
      // note: apparently ERC20 ABI contains wETH fns (deposit() and withdraw())
      const wethUnwrapData = this.erc20Interface.encodeFunctionData(
        WethFunctions.withdraw,
        [srcAmount],
      );
      callees.push(this.dexHelper.config.data.wrappedNativeTokenAddress);
      calldata.push(wethUnwrapData);
      values.push('0');
    }

    callees.push(destToken);
    calldata.push(this.swETHInterface.encodeFunctionData(
      swETHFunctions.deposit, // rswETH has the same interface
      [],
    ));
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
