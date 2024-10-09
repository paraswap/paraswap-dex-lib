import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  NumberAsString,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex, Context } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  WUSDMData,
  WUSDMFunctions,
  WusdmParams,
  WusdmPoolState,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { WUSDMConfig } from './config';
import { Utils } from '../../utils';
import { BI_POWS } from '../../bigint-constants';
import { WusdmEventPool } from './wusdm-pool';
import { Interface } from '@ethersproject/abi';
import wUSDM_ABI from '../../abi/wUSDM.json';
import { DEPOSIT_TOPIC, WITHDRAW_TOPIC } from './constants';
import { extractReturnAmountPosition } from '../../executor/utils';

export class WUSDM
  extends SimpleExchange
  implements IDex<WUSDMData, WusdmParams>
{
  readonly hasConstantPriceLargeAmounts = true;
  readonly isFeeOnTransferSupported = false;

  needWrapNative = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(WUSDMConfig);

  public readonly eventPool: WusdmEventPool;
  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly wUSDMAddress: string = WUSDMConfig[dexKey][network].wUSDMAddress,
    readonly USDMAddress: string = WUSDMConfig[dexKey][network].USDMAddress,
    readonly wUSDMInterface: Interface = new Interface(wUSDM_ABI),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPool = new WusdmEventPool(
      this.dexKey,
      this.network,
      `${this.wUSDMAddress}_${this.USDMAddress}`,
      dexHelper,
      this.wUSDMAddress,
      this.wUSDMInterface,
      this.logger,
      DEPOSIT_TOPIC,
      WITHDRAW_TOPIC,
    );
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  isAppropriatePair(srcToken: Token, destToken: Token): boolean {
    return (
      (this.isUSDM(srcToken.address) && this.isWUSDM(destToken.address)) ||
      (this.isWUSDM(srcToken.address) && this.isUSDM(destToken.address))
    );
  }

  async initializePricing(blockNumber: number) {
    await this.eventPool.initialize(blockNumber);
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    return this.isAppropriatePair(srcToken, destToken)
      ? [`${this.dexKey}_${this.wUSDMAddress}`]
      : [];
  }

  isUSDM(tokenAddress: Address) {
    return this.USDMAddress.toLowerCase() === tokenAddress.toLowerCase();
  }

  isWUSDM(tokenAddress: Address) {
    return this.wUSDMAddress.toLowerCase() === tokenAddress.toLowerCase();
  }

  isWrap(srcToken: Token, destToken: Token, side: SwapSide) {
    if (side === SwapSide.SELL) {
      return this.isUSDM(srcToken.address) && this.isWUSDM(destToken.address);
    }
    return this.isWUSDM(srcToken.address) && this.isUSDM(destToken.address);
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
  ): Promise<null | ExchangePrices<WUSDMData>> {
    if (!this.isAppropriatePair(srcToken, destToken)) return null;
    const state = this.eventPool.getState(blockNumber);
    if (!state) return null;

    const isSrcAsset = this.isUSDM(srcToken.address);

    const isWrap = this.isWrap(srcToken, destToken, side);

    let calcFunction: Function;

    if (side === SwapSide.SELL) {
      if (isSrcAsset) {
        calcFunction = this.previewDeposit.bind(this);
      } else {
        calcFunction = this.previewRedeem.bind(this);
      }
    } else {
      if (isSrcAsset) {
        calcFunction = this.previewMint.bind(this);
      } else {
        calcFunction = this.previewWithdraw.bind(this);
      }
    }
    return [
      {
        unit: BI_POWS[18],
        prices: amounts.map(amount => calcFunction(amount, state)),
        gasCost: isWrap ? 60000 : 70000,
        data: { exchange: `${this.wUSDMAddress}` },
        poolAddresses: [this.wUSDMAddress],
        exchange: this.dexKey,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<WUSDMData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.isUSDM(tokenAddress) && !this.isWUSDM(tokenAddress)) return [];

    return [
      {
        exchange: this.dexKey,
        address: this.wUSDMAddress,
        connectorTokens: [
          {
            decimals: 18,
            address: this.isUSDM(tokenAddress)
              ? this.wUSDMAddress
              : this.USDMAddress,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WUSDMData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const isSell = side === SwapSide.SELL;
    const { exchange } = data;

    let swapData: string;
    if (this.isUSDM(srcToken)) {
      swapData = this.wUSDMInterface.encodeFunctionData(
        isSell ? WUSDMFunctions.deposit : WUSDMFunctions.mint,
        [isSell ? srcAmount : destAmount, this.augustusAddress],
      );
    } else {
      swapData = this.wUSDMInterface.encodeFunctionData(
        isSell ? WUSDMFunctions.redeem : WUSDMFunctions.withdraw,
        [
          isSell ? srcAmount : destAmount,
          this.augustusAddress,
          this.augustusAddress,
        ],
      );
    }

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
      undefined,
      undefined,
      undefined,
      isSell && this.isUSDM(destToken),
    );
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: WUSDMData,
    side: SwapSide,
    _: Context,
    executorAddress: Address,
  ): DexExchangeParam {
    const isSell = side === SwapSide.SELL;
    const { exchange } = data;

    let swapData: string;
    if (this.isUSDM(srcToken)) {
      swapData = this.wUSDMInterface.encodeFunctionData(
        isSell ? WUSDMFunctions.deposit : WUSDMFunctions.mint,
        [isSell ? srcAmount : destAmount, recipient],
      );
    } else {
      swapData = this.wUSDMInterface.encodeFunctionData(
        isSell ? WUSDMFunctions.redeem : WUSDMFunctions.withdraw,
        [isSell ? srcAmount : destAmount, recipient, executorAddress],
      );
    }

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData: swapData,
      targetExchange: exchange,
      returnAmountPos: isSell
        ? extractReturnAmountPosition(
            this.wUSDMInterface,
            this.isUSDM(srcToken)
              ? WUSDMFunctions.deposit
              : WUSDMFunctions.redeem,
          )
        : undefined,
      skipApproval: this.isUSDM(destToken),
    };
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WUSDMData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { exchange } = data;

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          toStaked: 'bool',
        },
      },
      {
        toStaked: this.isUSDM(srcToken),
      },
    );

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

  previewRedeem(shares: bigint, state: WusdmPoolState) {
    return (shares * state.totalAssets) / state.totalShares;
  }

  previewMint(shares: bigint, state: WusdmPoolState) {
    return (shares * state.totalAssets) / state.totalShares;
  }

  previewWithdraw(assets: bigint, state: WusdmPoolState) {
    return (assets * state.totalShares) / state.totalAssets;
  }

  previewDeposit(assets: bigint, state: WusdmPoolState) {
    return (assets * state.totalShares) / state.totalAssets;
  }
}
