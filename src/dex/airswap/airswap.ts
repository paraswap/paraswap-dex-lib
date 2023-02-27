import {
  ExchangeTxInfo,
  PreprocessTransactionOptions,
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  OptimalSwapExchange,
} from '../../types';

import { SwapSide, Network, ETHER_ADDRESS } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AirswapData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AirSwapConfig, Adapters } from './config';
import { Interface } from 'ethers/lib/utils';
import ethers from 'ethers';
import { AddressZero } from '@ethersproject/constants';


import erc20ABI from '@airswap/swap-erc20/build/contracts/SwapERC20.sol/SwapERC20.json' assert { type: `json` };
import { getMakersLocatorForTX, getStakersUrl, getTx } from './airswap-tools';
import BigNumber from 'bignumber.js';

export class Airswap extends SimpleExchange implements IDex<AirswapData> {

  private makers: any;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;

  private localProvider: ethers.providers.InfuraWebSocketProvider

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AirSwapConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    readonly routerAddress: string = AirSwapConfig.Airswap[network].swapERC20,
    protected routerInterface = new Interface(JSON.stringify(erc20ABI)),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.localProvider = new ethers.providers.InfuraWebSocketProvider(
      this.dexHelper.config.data.network,
      process.env.INFURA_KEY,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // @TODO Put in cache data to build a map of makers that we will poll
    // get all satkers url for last look cahce, need to connect to any adresses below
    this.makers = await getStakersUrl(this.localProvider, AirSwapConfig.Airswap[this.network].makerRegistry);
    console.log("[AIRSWAP]", "makers:", this.makers)
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
    // TODO: complete me!
    return [];
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
  ): Promise<null | ExchangePrices<AirswapData>> {
    // TODO: complete me!
    return null;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<AirswapData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  // @TODO PARASWAP
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AirswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
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
    data: AirswapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the transaction arguments
    const swapData = '';

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): Promise<void> {
    return Promise.resolve()
  }

  isBlacklisted(userAddress?: string | undefined): Promise<boolean> {
    return Promise.resolve(false)
  }

  // change 0xeee burn address to native 0x000
  normalizeToken(token: Token): Token {
    return {
      address:
        token.address.toLowerCase() === ETHER_ADDRESS
          ? AddressZero
          : token.address.toLowerCase(),
      decimals: token.decimals,
    };
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<AirswapData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<AirswapData>, ExchangeTxInfo]> {
    if (await this.isBlacklisted(options.txOrigin)) {
      this.logger.warn(
        `${this.dexKey}-${this.network}: blacklisted TX Origin address '${options.txOrigin}' trying to build a transaction. Bailing...`,
      );
      throw new Error(
        `${this.dexKey}-${this.network
        }: user=${options.txOrigin.toLowerCase()} is blacklisted`,
      );
    }

    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    const amount = side === SwapSide.SELL
      ? optimalSwapExchange.srcAmount
      : optimalSwapExchange.destAmount

    const makers = await getMakersLocatorForTX(this.localProvider, normalizedSrcToken, normalizedDestToken, this.network)
    const response = await Promise.race(
      makers.map(maker => {
        return getTx(maker.url, maker.swapContract, this.augustusAddress.toLowerCase(), normalizedSrcToken, normalizedDestToken, amount);
      })
    );


    return [
      {
        ...optimalSwapExchange,
        data: {
          exchange: "i do not know what to write",
          ...response,
        },
      },
      { deadline: BigInt(response.expiry) },
    ];
  }
}
