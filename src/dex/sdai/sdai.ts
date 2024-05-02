import { SimpleExchange } from '../simple-exchange';
import { IDex } from '../idex';
import { DexParams, SDaiData, SDaiFunctions } from './types';
import { NULL_ADDRESS, Network, SwapSide } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { Adapters, SDaiConfig } from './config';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  Logger,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { IDexHelper } from '../../dex-helper';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { BI_POWS } from '../../bigint-constants';
import SavingsDaiAbi from '../../abi/sdai/SavingsDai.abi.json';
import { Interface } from 'ethers/lib/utils';

const SDAI_GAS_COST = 1000000;

export class SDai extends SimpleExchange implements IDex<SDaiData, DexParams> {
  readonly hasConstantPriceLargeAmounts = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SDaiConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,

    readonly sdaiAddress: string = SDaiConfig[dexKey][network].sdaiAddress,
    readonly daiAddress: string = SDaiConfig[dexKey][network].daiAddress,

    protected unitPrice = BI_POWS[18],
    protected adapters = Adapters[network] || {},

    protected sdaiInterface = new Interface(SavingsDaiAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
  }

  // TODO:
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] || null;
  }

  isSDai(tokenAddress: Address) {
    return this.sdaiAddress.toLowerCase() === tokenAddress.toLowerCase();
  }

  isDai(tokenAddress: Address) {
    return this.daiAddress.toLowerCase() === tokenAddress.toLowerCase();
  }

  isAppropriatePair(srcToken: Token, destToken: Token) {
    return (
      (this.isDai(srcToken.address) && this.isSDai(destToken.address)) ||
      (this.isDai(destToken.address) && this.isSDai(srcToken.address))
    );
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (this.isAppropriatePair(srcToken, destToken)) {
      return [`${this.dexKey}_${srcToken.address}_${destToken.address}`];
    }

    return [];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SDaiData>> {
    if (!this.isAppropriatePair(srcToken, destToken)) {
      return null;
    }

    // TODO: wtf is unit???
    return [
      {
        prices: amounts,
        unit: this.unitPrice,
        gasCost: SDAI_GAS_COST,
        exchange: this.dexKey,
        poolAddresses: [this.sdaiAddress],
        data: null,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<SDaiData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SDaiData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapData = this.sdaiInterface.encodeFunctionData(
      this.isDai(srcToken) ? SDaiFunctions.deposit : SDaiFunctions.redeem,
      [srcAmount, this.augustusAddress],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.sdaiAddress,
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SDaiData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: NULL_ADDRESS,
      payload: '0x',
      networkFee: '0',
    };
  }
}
