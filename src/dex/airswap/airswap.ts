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
import { AirswapData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AirSwapConfig, Adapters } from './config';
import { Interface } from 'ethers/lib/utils';
import { ethers } from 'ethers';
import { AddressZero } from '@ethersproject/constants';

import swapABI from '@airswap/swap-erc20/build/contracts/SwapERC20.sol/SwapERC20.json';
import deploys from '@airswap/swap-erc20/deploys.js';
import {
  getAvailableMakersForRFQ,
  getServersUrl,
  getThresholdsFromMaker,
  makeRFQ,
  priceFromThreshold,
} from './airswap-tools';
import BigNumber from 'bignumber.js';
import { Server } from '@airswap/libraries';

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

  private localProvider: ethers.providers.JsonRpcProvider;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AirSwapConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    readonly routerAddress: string = deploys[network],
    protected routerInterface = new Interface(JSON.stringify(swapABI.abi)),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.localProvider = new ethers.providers.JsonRpcProvider(
      this.dexHelper.config.data.privateHttpProvider,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {}

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
      normalizedSrcToken.address,
      this.localProvider,
      this.network,
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
    // console.log('===================== will use pool =====>', limitPools);
    const pools =
      limitPools ??
      (await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber));
    const marketMakersUris = pools
      .map(this.getMakerUrlFromKey)
      .filter(maker => maker != undefined) as string[];
    const levels = (
      await getThresholdsFromMaker(marketMakersUris, srcToken, destToken, side)
    ).filter(l => l != undefined);
    const prices = levels.map(({ maker, levels }) => {
      const amountsRaw = amounts.map(
        amount => new BigNumber(amount.toString()),
      );

      const { unitPrice, prices } = priceFromThreshold(
        amountsRaw,
        levels,
        normalizedSrcToken,
        normalizedDestToken,
        side,
      );

      // console.log(
      //   'computePricesFromLevels prices',
      //   amounts,
      //   amountsRaw,
      //   prices,
      //   levels,
      // );
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
    const pricesWithout0n = prices.filter(price => {
      const prices = price.prices.filter(p => p > 0n);
      return prices.length > 0;
    });
    // console.log('pricesWithout0n', pricesWithout0n);
    return pricesWithout0n;
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
        `${this.dexKey}-${
          this.network
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
      this.network,
    );
    const maker = await Server.at(optimalSwapExchange.data!.maker, {
      chainId: this.network,
    });
    const response = await makeRFQ(
      maker,
      this.augustusAddress.toLocaleLowerCase(),
      normalizedSrcToken,
      normalizedDestToken,
      amount,
    );

    if (!response || !response.signedOrder) {
      throw new Error('No responses from maker');
    }

    return [
      {
        ...optimalSwapExchange,
        data: {
          maker: response.maker,
          senderWallet: this.augustusAddress,
          signedOrder: response.signedOrder,
        },
      },
      { deadline: BigInt(response.signedOrder.expiry) },
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
