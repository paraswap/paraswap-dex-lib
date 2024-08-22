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
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { WUSDMData, DexParams, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { WUSDMConfig, Adapters } from './config';
import { Utils } from '../../utils';
import { Interface } from '@ethersproject/abi';
import wUSDM_ABI from '../../abi/wUSDM.json';
import USDM_ABI from '../../abi/USDM.json';
import { extractReturnAmountPosition } from '../../executor/utils';
import { uint256ToBigInt } from '../../lib/decoders';

export class WUSDM extends SimpleExchange implements IDex<WUSDMData> {
  static readonly wUSDMIface = new Interface(wUSDM_ABI);
  static readonly USDMIface = new Interface(USDM_ABI);

  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(WUSDMConfig);

  logger: Logger;

  private state: { blockNumber: number } & PoolState = {
    blockNumber: 0,
    totalAssets: 0n,
    totalShares: 0n,
  };

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    const config = WUSDMConfig[dexKey][network];
    this.config = {
      wUSDMAddress: config.wUSDMAddress.toLowerCase(),
      USDMAddress: config.USDMAddress.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
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
    if (side === SwapSide.BUY) return [];
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      !(
        (srcTokenAddress === this.config.wUSDMAddress &&
          destTokenAddress === this.config.USDMAddress) ||
        (srcTokenAddress === this.config.USDMAddress &&
          destTokenAddress === this.config.wUSDMAddress)
      )
    ) {
      return [];
    }
    return [this.dexKey];
  }

  protected calcWrap = (amount: bigint): bigint =>
    (amount * this.state.totalShares) / this.state.totalAssets;

  protected calcUnwrap = (amount: bigint): bigint =>
    (amount * this.state.totalAssets) / this.state.totalShares;

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
    if (side === SwapSide.BUY) return null;
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      !(
        (srcTokenAddress === this.config.wUSDMAddress &&
          destTokenAddress === this.config.USDMAddress) ||
        (srcTokenAddress === this.config.USDMAddress &&
          destTokenAddress === this.config.wUSDMAddress)
      )
    ) {
      return null;
    }
    const wrap = srcTokenAddress === this.config.USDMAddress;

    if (blockNumber > this.state.blockNumber) {
      const cached = await this.dexHelper.cache.get(
        this.dexKey,
        this.network,
        'state',
      );
      if (cached) {
        this.state = Utils.Parse(cached);
      }
      if (blockNumber > this.state.blockNumber) {
        const calls = [
          {
            target: this.config.wUSDMAddress,
            callData: WUSDM.wUSDMIface.encodeFunctionData('totalSupply'),
            decodeFunction: uint256ToBigInt,
          },
          {
            target: this.config.wUSDMAddress,
            callData: WUSDM.wUSDMIface.encodeFunctionData('totalAssets'),
            decodeFunction: uint256ToBigInt,
          },
        ];
        const results = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
          true,
          calls,
          blockNumber,
        );
        this.state = {
          blockNumber,
          totalShares: results[0].returnData,
          totalAssets: results[1].returnData,
        };
        this.dexHelper.cache.setex(
          this.dexKey,
          this.network,
          'state',
          60,
          Utils.Serialize(this.state),
        );
      }
    }

    const calc = wrap ? this.calcWrap : this.calcUnwrap;
    return [
      {
        unit: calc(1000000000000000000n),
        prices: amounts.map(calc),
        data: {},
        poolAddresses: [this.config.wUSDMAddress],
        exchange: this.dexKey,
        gasCost: wrap ? 60000 : 70000,
        poolIdentifier: this.dexKey,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<WUSDMData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  async getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: WUSDMData,
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    const swapFunction =
      srcToken.toLowerCase() === this.config.wUSDMAddress
        ? 'redeem'
        : 'deposit';
    const exchangeData =
      swapFunction === 'deposit'
        ? WUSDM.wUSDMIface.encodeFunctionData('deposit', [srcAmount, recipient])
        : WUSDM.wUSDMIface.encodeFunctionData('redeem', [
            srcAmount,
            recipient,
            recipient,
          ]);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: false,
      exchangeData,
      targetExchange: this.config.wUSDMAddress,
      returnAmountPos:
        side === SwapSide.SELL
          ? extractReturnAmountPosition(WUSDM.wUSDMIface, swapFunction)
          : undefined,
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
    return {
      targetExchange: this.config.wUSDMAddress,
      payload: '0x',
      networkFee: '0',
    };
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    tokenAddress = tokenAddress.toLowerCase();
    if (
      tokenAddress !== this.config.USDMAddress &&
      tokenAddress !== this.config.wUSDMAddress
    ) {
      return [];
    }
    return [
      {
        exchange: this.dexKey,
        address: this.config.wUSDMAddress,
        connectorTokens: [
          {
            decimals: 18,
            address:
              tokenAddress === this.config.USDMAddress
                ? this.config.wUSDMAddress
                : this.config.USDMAddress,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
