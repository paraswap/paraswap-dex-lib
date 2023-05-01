import {
  ExchangeTxInfo,
  PreprocessTransactionOptions,
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  Logger,
  OptimalSwapExchange,
  PoolLiquidity,
} from '../../types';

import { SwapSide, Network, ETHER_ADDRESS } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AirswapData, PriceLevel, QuoteResponse } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AirSwapConfig, Adapters } from './config';
import { Interface } from 'ethers/lib/utils';
import { ethers } from 'ethers';
import { AddressZero } from '@ethersproject/constants';

import swapABI from '@airswap/swap-erc20/build/contracts/SwapERC20.sol/SwapERC20.json';
import {
  computePricesFromLevels,
  getAvailableMakersForRFQ,
  getServersUrl,
  makeRFQ,
  mapMakerResponse,
} from './airswap-tools';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import BigNumber from 'bignumber.js';

type temporaryMakerAnswer = {
  pairs: {
    baseToken: string;
    quoteToken: string;
  }[];
};

export class Airswap extends SimpleExchange implements IDex<AirswapData> {
  private makers: any;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;

  private localProvider: ethers.providers.InfuraWebSocketProvider;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AirSwapConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    readonly routerAddress: string = AirSwapConfig.AirSwap[network].swapErc20,
    protected routerInterface = new Interface(JSON.stringify(swapABI.abi)),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.localProvider = ethers.providers.InfuraProvider.getWebSocketProvider(
      this.dexHelper.config.data.network,
      process.env.INFURA_KEY,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) { }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  forgePairTokenKey = (srcAddress: Address, destAddress: Address) =>
    `${srcAddress}_${destAddress}`.toLowerCase();

  getPoolIdentifier(
    srcAddress: Address,
    destAddress: Address,
    makerName: string = '',
  ) {
    const pairTokenKey = this.forgePairTokenKey(srcAddress, destAddress);
    return `${this.dexKey}_${pairTokenKey}_${makerName}`.toLowerCase();
  }

  getMakerUrlFromKey(key: string) {
    return key.split(`_`).pop();
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    if (normalizedSrcToken.address === normalizedDestToken.address) {
      return [];
    }

    const urls = await getServersUrl(
      normalizedDestToken.address,
      destToken.address,
      AirSwapConfig.AirSwap[this.network].makerRegistry,
      this.localProvider,
    );
    const makerAndPairs: Record<string, temporaryMakerAnswer> = urls.reduce(
      (dict, url) => {
        const entry: Record<string, temporaryMakerAnswer> = {};
        entry[url] = {
          pairs: [
            {
              baseToken: normalizedSrcToken.address,
              quoteToken: normalizedDestToken.address,
            },
          ],
        };
        return { ...entry, ...dict };
      },
      {},
    );
    const makers = Object.keys(makerAndPairs);
    return makers
      .filter((makerName: string) => {
        const pairs = makerAndPairs[makerName].pairs ?? [];
        return pairs.some(
          pair =>
            normalizedSrcToken.address === pair.baseToken.toLowerCase() &&
            normalizedDestToken.address === pair.quoteToken.toLowerCase(),
        );
      })
      .map(makerName =>
        this.getPoolIdentifier(
          normalizedSrcToken.address,
          normalizedDestToken.address,
          makerName,
        ),
      );
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
    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    if (normalizedSrcToken.address === normalizedDestToken.address) {
      return null;
    }

    const pools =
      limitPools ??
      (await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber));

    const marketMakersUris = pools.map(this.getMakerUrlFromKey);
    // get pricing to corresponding pair token for each maker
    const mockedBids = mapMakerResponse([
      [
          1,
          1.0000804135489818
      ],
      [
          28632.23189406919,
          1.000031329146842
      ],
      [
          60127.68697754531,
          0.9999282642399678
      ],
      [
          94772.68756936904,
          0.9998149093727866
      ],
      [
          132882.18822037516,
          0.9996902412973147
      ],
      [
          174802.63893648188,
          0.9995531333644397
      ],
      [
          220915.13472419925,
          0.9994023472389632
      ]
  ]);
    const levelRequests = marketMakersUris.map(url => ({
      maker: url,
      levels: mockedBids, //maker.getPricing(url, srcToken, destToken), @TODO
    }));
    const levels = await Promise.all(levelRequests);

    const prices = levels.map(({ maker, levels }) => {
      const divider = getBigNumberPow(
        side === SwapSide.SELL
          ? normalizedSrcToken.decimals
          : normalizedDestToken.decimals,
      );

      const amountsRaw = amounts.map(amount =>
        new BigNumber(amount.toString()).dividedBy(divider),
      );

      const unitPrice: bigint = computePricesFromLevels(
        [BN_1],
        levels,
        normalizedSrcToken,
        normalizedDestToken,
        side,
      )[0];
      const prices = computePricesFromLevels(
        amountsRaw,
        levels,
        normalizedSrcToken,
        normalizedDestToken,
        side,
      );
console.log("prices", prices)
      return {
        gasCost: 100 * 1000, // estimated fees
        exchange: this.dexKey,
        data: { maker } as AirswapData,
        prices,
        unit: unitPrice,
        poolIdentifier: this.getPoolIdentifier(
          normalizedSrcToken.address,
          normalizedDestToken.address,
          maker,
        ),
        poolAddresses: [this.routerAddress],
      };
    });
    console.log(prices)
    return prices;
  }

  // @TODO Heeeeelp
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
    const { maker } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: maker,
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
    const { maker, senderWallet, signedOrder } = data;

    const values = [
      senderWallet,
      signedOrder.nonce,
      signedOrder.expiry,
      signedOrder.signerWallet,
      signedOrder.signerToken,
      signedOrder.signerAmount,
      signedOrder.senderToken,
      signedOrder.senderAmount,
      signedOrder.v,
      signedOrder.r,
      signedOrder.s,
    ];

    // Encode here the transaction arguments
    const swapData = this.routerInterface.encodeFunctionData('swap', values);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      signedOrder.senderAmount,
      destToken,
      signedOrder.signerAmount,
      swapData,
      this.routerAddress,
    );
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): Promise<void> {
    this.localProvider.websocket.close();
    return Promise.resolve();
  }

  isBlacklisted(userAddress?: string | undefined): Promise<boolean> {
    return Promise.resolve(false);
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

    const amount =
      side === SwapSide.SELL
        ? optimalSwapExchange.srcAmount
        : optimalSwapExchange.destAmount;

    const makers = await getAvailableMakersForRFQ(
      this.localProvider,
      normalizedSrcToken,
      normalizedDestToken,
      AirSwapConfig.AirSwap[this.network].makerRegistry,
    );
    let responses = {} as PromiseFulfilledResult<QuoteResponse>[];
    try {
      responses =
        makers.length > 0
          ? await Promise.allSettled(
            makers.map(maker => {
              return makeRFQ(
                maker,
                this.augustusAddress.toLocaleLowerCase(),
                normalizedSrcToken,
                normalizedDestToken,
                amount,
              );
            }),
          )
          : ({} as unknown as any);
    } catch (error) {
      console.error(error);
    }

    const firstResponse = responses
      .filter(promise => promise.status === 'fulfilled')
      .map(
        (promise: PromiseFulfilledResult<QuoteResponse>) => promise.value,
      )[0];

    console.log(firstResponse);
    return [
      {
        ...optimalSwapExchange,
        data: {
          maker: firstResponse.maker,
          senderWallet: this.augustusAddress,
          signedOrder: firstResponse.signedOrder,
        },
      },
      { deadline: BigInt(firstResponse.signedOrder.expiry) },
    ];
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

  getTokenFromAddress?(address: Address): Token {
    // We don't have predefined set of tokens with decimals
    // Anyway we don't use decimals, so it is fine to do this
    return { address, decimals: 0 };
  }
}
