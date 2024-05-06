import { SimpleExchange } from '../simple-exchange';
import { IDex } from '../idex';
import { SDaiParams, SDaiData, SDaiFunctions } from './types';
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
import PotAbi from '../../abi/maker-psm/pot.json';
import SavingsDaiAbi from '../../abi/sdai/SavingsDai.abi.json';
import { Interface } from 'ethers/lib/utils';
import { getOnChainState } from './utils';
import { SDaiPool } from './sdai-pool';
import { BI_POWS } from '../../bigint-constants';
import { SDAI_DEPOSIT_GAS_COST } from './constants';

export class SDai extends SimpleExchange implements IDex<SDaiData, SDaiParams> {
  readonly hasConstantPriceLargeAmounts = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SDaiConfig);

  protected eventPool: SDaiPool;
  logger: Logger;

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,

    readonly daiAddress: string = SDaiConfig[dexKey][network].daiAddress,
    readonly sdaiAddress: string = SDaiConfig[dexKey][network].sdaiAddress,
    readonly potAddress: string = SDaiConfig[dexKey][network].potAddress,

    protected adapters = Adapters[network] || {},
    protected sdaiInterface = new Interface(SavingsDaiAbi),
    protected potInterface = new Interface(PotAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPool = new SDaiPool(
      this.dexKey,
      dexHelper,
      this.potAddress,
      this.potInterface,
      this.logger,
    );
  }

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

  async initializePricing(blockNumber: number) {
    const poolState = await getOnChainState(
      this.dexHelper.multiContract,
      this.potAddress,
      this.potInterface,
      blockNumber,
    );

    await this.eventPool.initialize(blockNumber, {
      state: poolState,
    });
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    // TODO: remove this fn call
    await this.initializePricing(blockNumber);

    return this.isAppropriatePair(srcToken, destToken)
      ? [`${this.dexKey}_${srcToken.address}_${destToken.address}`]
      : [];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SDaiData>> {
    if (!this.isAppropriatePair(srcToken, destToken)) return null;
    if (this.eventPool.getState(blockNumber) === null) return null;

    const convertFn = (blockNumber: number, amountIn: bigint) =>
      this.isDai(srcToken.address)
        ? this.eventPool.convertToSDai(blockNumber, amountIn)
        : this.eventPool.convertToDai(blockNumber, amountIn);

    const unitIn = BI_POWS[18];
    const unitOut = convertFn(blockNumber, unitIn);
    const amountsOut = amounts.map(amountIn =>
      convertFn(blockNumber, amountIn),
    );

    return [
      {
        prices: amountsOut,
        unit: unitOut,
        gasCost: SDAI_DEPOSIT_GAS_COST,
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
    if (!this.isDai(tokenAddress) && !this.isSDai(tokenAddress)) return [];

    return [
      {
        exchange: this.dexKey,
        address: this.sdaiAddress,
        connectorTokens: [
          {
            decimals: 18,
            address: this.isDai(tokenAddress)
              ? this.sdaiAddress
              : this.daiAddress,
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
    data: SDaiData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapData = this.sdaiInterface.encodeFunctionData(
      this.isDai(srcToken) ? SDaiFunctions.deposit : SDaiFunctions.redeem,
      this.isDai(srcToken)
        ? [srcAmount, this.augustusAddress]
        : [srcAmount, this.augustusAddress, this.augustusAddress],
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
