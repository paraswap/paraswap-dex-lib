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
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { UsualBondData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { UsualBondConfig, Adapters } from './config';
import { UsualBondEventPool } from './usual-bond-pool';

export class UsualBond extends SimpleExchange implements IDex<UsualBondData> {
  readonly hasConstantPriceLargeAmounts = true;

  // Set true here if protocols works only with wrapped asset
  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  readonly config: DexParams;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UsualBondConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    const config = UsualBondConfig[dexKey][network];
    this.config = {
      usd0Address: config.usd0Address,
      usd0ppAddress: config.usd0ppAddress,
    };
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
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
    // We want this route to be used only for buying USD0++ from USD0
    if (side === SwapSide.BUY) return [];
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      !(
        srcTokenAddress === this.config.usd0Address &&
        destTokenAddress === this.config.usd0ppAddress
      )
    ) {
      return [];
    }
    return [this.dexKey];
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
  ): Promise<null | ExchangePrices<UsualBondData>> {
    if (side === SwapSide.BUY) return null;
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      !(
        srcTokenAddress === this.config.usd0Address &&
        destTokenAddress === this.config.usd0ppAddress
      )
    ) {
      return null;
    }

    return [
      {
        unit: 1000000000000000000n,
        prices: amounts,
        data: {},
        poolAddresses: [this.config.usd0ppAddress],
        exchange: this.dexKey,
        gasCost: 70000,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<UsualBondData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
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
    data: UsualBondData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // Encode here the payload for adapter
    const payload = '0x';

    return {
      targetExchange: this.config.usd0Address,
      payload,
      networkFee: '0',
    };
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [
      {
        exchange: this.dexKey,
        address: this.config.usd0ppAddress,
        connectorTokens: [],
        liquidityUSD: 1000000000000000000,
      },
    ];
  }
}
