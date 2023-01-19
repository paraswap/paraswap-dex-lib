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
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AirSwapData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AirSwapConfig, Adapters } from './config';
import { AirSwapEventPool } from './airswap-pool';
import _ from 'lodash';
import { Registry } from '@airswap/protocols';
import { ethers } from 'ethers';
import { Maker } from '@airswap/libraries';

export class AirSwap extends SimpleExchange implements IDex<AirSwapData> {
  protected eventPools: AirSwapEventPool;

  readonly hasConstantPriceLargeAmounts = true; // 0.07/100
  // TODO: set true here if protocols works only with wrapped asset
  // wrapper n'a ps l'air d'etre activé pour nous, essayer ERC20

  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AirSwapConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new AirSwapEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // We should initalize a map of swap for each pair of famous tokens
    // to speed retrivial then update it asynchonously
    // final optim
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    // Airswap is, we think, not intended to be used like that : it swaps, buy and sell are the same thing
    console.log('getAdapaters', side, this.adapters, this.adapters[side]);
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
    const pairs = await this.getAvailableMakersForRFQ(srcToken, destToken);
    const keys = pairs.map(
      maker =>
        `${this.dexKey};${srcToken.address};${destToken.address};${maker.client.options.protocol}//${maker.client.options.hostname};${maker.swapContract}`,
    );
    return Promise.resolve(keys);
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  //
  // We should ask market makers for the given volume and the one or one of the cheapest
  // asynchnously updating the map to speed up
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<AirSwapData>> {
    if (
      srcToken.address == destToken.address ||
      !limitPools ||
      limitPools.length == 0
    ) {
      return Promise.resolve(null);
    }
    const [dexKey, dexSrcToken, desDestToken, host, swapContract] =
      limitPools[0].split(';');
    console.log('getPricesVolume', limitPools[0], host);
    const maker = await Maker.at(host, {
      swapContract: '0x522d6f36c95a1b6509a14272c17747bbb582f2a6',
    }); //@TODO: where to find this contract ?
    const senderWallet = '0x841EB48aA8b02354A774912405bb29382a60A355'; //@TODO how to get the wallet ?
    const requests = amounts
      .filter(amount => amount > 0)
      .map(amount =>
        maker.getSignerSideOrder(
          amount.toString(),
          destToken.address,
          srcToken.address,
          senderWallet,
        ),
      );
    console.log('getPricesVolume', requests);
    const responses = await Promise.all(requests);
    console.log('getPricesVolume responses', responses);
    const answer = responses.map(response =>
      this.formatPayload(
        srcToken,
        destToken,
        amounts,
        side,
        limitPools[0],
        response,
      ),
    );
    console.log('getPricesVolume answer', responses);
    return Promise.resolve(answer);
  }

  private formatPayload(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: string,
    limitPools: string,
    data: any,
  ) {
    return {
      prices: amounts,
      unit: getBigIntPow(
        (side === SwapSide.SELL ? destToken : srcToken).decimals,
      ),
      gasCost: 7, // @Todo how to get the gaz fees tor run the transaction ?
      data: {
        airswapMetaData: {
          // this random should be removed and have a plain object
          maker: limitPools, // thos fields are needed for the transcation
          srcToken,
          destToken,
          amounts,
          data,
        },
        exchange: this.dexKey,
      },
      exchange: this.dexKey,
    };
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<AirSwapData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    console.log('getCalldataGasCost', poolPrices);
    return 0.0007; // TODO : what to do ?
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AirSwapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // return that :
    // TODO: complete me!
    const { exchange } = data;
    console.log('getAdapterParam', 'getAdapterParam', exchange, data);
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
    data: AirSwapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
    const { airswapMetaData, exchange } = data;

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

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    return Promise.resolve();
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    // we do not have pool
    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    return Promise.resolve();
  }

  private async getAvailableMakersForRFQ(
    from: Token,
    to: Token,
  ): Promise<any[]> {
    const provider = ethers.getDefaultProvider(this.network);
    //@ts-ignore
    const servers = await new Registry(this.network, provider).getServers(
      from.address,
      to.address,
    );
    console.log('getAvailableMakersForRFQ', servers);
    return Promise.resolve(servers);
  }
}
