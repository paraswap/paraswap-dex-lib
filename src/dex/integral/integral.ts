import _ from 'lodash';
import { DeepReadonly } from 'ts-essentials';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  PoolPrices,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { getBigIntPow, getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  IntegralData,
  IntegralFunctions,
  IntegralPair,
  IntegralPoolState,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { IntegralConfig, Adapters } from './config';
import { IntegralEventPool } from './integral-pool';
import IntegralRelayerABI from '../../abi/integral/relayer.json';
import { Interface } from '@ethersproject/abi';
import { BigNumber } from 'ethers';
import { BI_POWS } from '../../bigint-constants';

const PRECISION = BI_POWS[18];
const SUBGRAPH_TIMEOUT = 20 * 1000;
const relayerInterface = new Interface(IntegralRelayerABI);

export class Integral
  extends SimpleExchange
  implements IDex<IntegralData>
{
  pairs: { [key: string]: IntegralPair } = {};
  protected eventPools: IntegralEventPool;

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(IntegralConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected relayerAddress: Address = IntegralConfig[dexKey][network]
      .relayerAddress,
    protected subgraphURL: string | undefined = IntegralConfig[dexKey][
      network
    ].subgraphURL,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);

    this.eventPools = new IntegralEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
  }

  async initializePricing(blockNumber: number) { }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const src = this.dexHelper.config.wrapETH(srcToken);
    const dest = this.dexHelper.config.wrapETH(destToken);

    if (src.address.toLowerCase() === dest.address.toLowerCase()) {
      return [];
    }

    const tokenAddress = [src.address.toLowerCase(), dest.address.toLowerCase()]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
    return [poolIdentifier];
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
  ): Promise<null | ExchangePrices<IntegralData>> {
    const src = this.dexHelper.config.wrapETH(srcToken);
    const dest = this.dexHelper.config.wrapETH(destToken);
    if (src.address.toLowerCase() === dest.address.toLowerCase()) {
      return null;
    }

    const tokenAddress = [src.address.toLowerCase(), dest.address.toLowerCase()]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');
    const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
    if (limitPools && limitPools.every(p => p !== poolIdentifier)) {
      return null;
    }

    await this.syncPair([src, dest], blockNumber);
    const pair = this.findPair(src, dest);
    if (!(pair && pair.pool)) {
      return null;
    }
    const pairState = pair.pool.getState(blockNumber);
    if (!pairState) {
      return null;
    }

    const unitAmount = getBigIntPow(side == SwapSide.SELL ? src.decimals : dest.decimals);
    const unit =
      side == SwapSide.SELL
        ? this.calculateAmountOutWithFee(unitAmount, src, dest, pairState, false)
        : this.calcAmountInWithFee(unitAmount, src, dest, pairState, false);
    try {
      const prices =
        side == SwapSide.SELL
          ? amounts.map(amount => this.calculateAmountOutWithFee(amount, src, dest, pairState))
          : amounts.map(amount => this.calcAmountInWithFee(amount, src, dest, pairState));

      return [
        {
          prices: prices,
          unit: unit,
          data: {
            relayer: this.relayerAddress,
          },
          exchange: this.dexKey,
          poolIdentifier,
          gasCost: 0,
          poolAddresses: [this.relayerAddress],
        },
      ];
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume could not get price with error:`,
        e,
      );
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<IntegralData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IntegralData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { relayer: exchange } = data;

    // Encode here the payload for adapter
    const payload = '0x';

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
    data: IntegralData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { relayer: exchange } = data;

    // Encode here the transaction arguments
    const swapData = relayerInterface.encodeFunctionData(
      side === SwapSide.SELL
        ? IntegralFunctions.swap
        : IntegralFunctions.buy,
      [
        {
          ...{
            tokenIn: this.dexHelper.config.wrapETH({
              address: srcToken,
            } as Token).address,
            tokenOut: this.dexHelper.config.wrapETH({
              address: destToken,
            } as Token).address,
            wrapUnwrap: isETHAddress(srcToken) || isETHAddress(destToken),
            to: this.augustusAddress,
            submitDeadline: Math.floor(Date.now() / 1000) + 24 * 3600,
          },
          ...(side === SwapSide.SELL
            ? { amountIn: srcAmount, amountOutMin: destAmount }
            : { amountInMax: srcAmount, amountOut: destAmount }),
        },
      ],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  async updatePoolState(): Promise<void> { }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.subgraphURL) {
      return [];
    }
    const query = `
      query ($token: Bytes!, $count: Int) {
        pools0: pairs(
          first: $count
          orderBy: reserveUSD
          orderDirection: desc
          where: {token0: $token}
        ) {
          id
          token0 {
            id
            decimals
          }
          token1 {
            id
            decimals
          }
          reserveUSD
        }
        pools1: pairs(
          first: $count
          orderBy: reserveUSD
          orderDirection: desc
          where: {token1: $token}
        ) {
          id
          token0 {
            id
            decimals
          }
          token1 {
            id
            decimals
          }
          reserveUSD
        }
      }`;
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      {
        query,
        variables: { token: tokenAddress.toLowerCase(), limit },
      },
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools0 && data.pools1))
      throw new Error("Couldn't fetch the pools from the subgraph");
    const pools0 = _.map(data.pools0, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token1.id.toLowerCase(),
          decimals: parseInt(pool.token1.decimals),
        },
      ],
      liquidityUSD: parseFloat(pool.reserveUSD),
    }));

    const pools1 = _.map(data.pools1, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token0.id.toLowerCase(),
          decimals: parseInt(pool.token0.decimals),
        },
      ],
      liquidityUSD: parseFloat(pool.reserveUSD),
    }));

    return _.slice(
      _.sortBy(_.concat(pools0, pools1), [pool => -1 * pool.liquidityUSD]),
      0,
      limit,
    );
  }

  async getPriceOnChain(pair: IntegralPair, blockNumber: number) {
    try {
      const calldata = [
        {
          target: this.relayerAddress,
          callData: relayerInterface.encodeFunctionData(
            'getPoolState',
            [pair.token0.address, pair.token1.address],
          ),
        },
        {
          target: this.relayerAddress,
          callData: relayerInterface.encodeFunctionData(
            'getPoolState',
            [pair.token1.address, pair.token0.address],
          ),
        }
      ];

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const result = relayerInterface.decodeFunctionResult(
        'getPoolState',
        data.returnData[0],
      )
      const invertedResult = relayerInterface.decodeFunctionResult(
        'getPoolState',
        data.returnData[1],
      )
      return {
        price: BigInt(result.price.toString()),
        invertedPrice: BigInt(invertedResult.price.toString()),
        fee: BigInt(result.fee.toString()),
        limits0: [result.limitMin0, result.limitMax0].map((limit: BigNumber) => BigInt(limit.toString())),
        limits1: [result.limitMin1, result.limitMax1].map((limit: BigNumber) => BigInt(limit.toString())),
      } as IntegralPoolState;
    } catch (e) {
      this.logger.error(
        `Error_getPriceOnChain could not get data with error:`,
        e,
      );
      return null;
    }
  }

  protected async addPool(
    pair: IntegralPair,
    params: IntegralPoolState,
    blockNumber: number,
  ) {
    pair.pool = new IntegralEventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
    );

    if (blockNumber) {
      pair.pool.setState(params, blockNumber);
    }
  }

  async syncPair(_pair: [Token, Token], blockNumber: number) {
    if (!blockNumber) {
      return;
    }
    const pair = this.findPair(_pair[0], _pair[1]);
    if (!pair) {
      return;
    }
    if (pair.pool && pair.pool.getState(blockNumber)) {
      return;
    }

    const states = await this.getPriceOnChain(pair, blockNumber);

    if (!states) {
      this.logger.error(`Error_getPriceOnChain didn't get any prices`);
      return;
    }

    if (!pair.pool) {
      await this.addPool(pair, states, blockNumber);
    } else {
      pair.pool.setState(states, blockNumber);
    }
  }

  private findPair(from: Token, to: Token) {
    if (from.address.toLocaleLowerCase() === to.address.toLowerCase()) {
      return null;
    }

    const { key, token0, token1 } = this.generatePairKey(from, to);
    if (!this.pairs[key]) {
      this.pairs[key] = { token0, token1 };
    }
    return this.pairs[key];
  }

  private generatePairKey(tokenA: Token, tokenB: Token) {
    const inverted = tokenA.address.toLowerCase() > tokenB.address.toLowerCase();
    const [token0, token1] = inverted ? [tokenB, tokenA] : [tokenA, tokenB];
    return {
      key: `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}`,
      token0,
      token1,
    };
  }

  private calculateAmountOutWithFee(
    amountIn: bigint,
    tokenIn: Token,
    tokenOut: Token,
    state: DeepReadonly<IntegralPoolState>,
    checkLimit: boolean = true
  ) {
    if (amountIn === 0n) {
      return 0n;
    }
    const pair = this.findPair(tokenIn, tokenOut)
    if (!pair) {
      return 0n
    }
    const inverted = !this.isFirst(tokenIn.address, pair)

    const fee = (amountIn * state.fee) / PRECISION;
    const amountInMinusFee = amountIn - fee;
    const price = inverted ? state.invertedPrice : state.price;
    const decimalsConverter = this.getDecimalsConverter(pair.token0.decimals, pair.token1.decimals, inverted);
    const amountOut = (amountInMinusFee * price) / decimalsConverter;
    if (checkLimit && !this.checkLimits(amountOut, this.isFirst(tokenOut.address, pair) ? state.limits0 : state.limits1)) {
      throw new Error('Out of Limits')
    }
    return amountOut;
  }

  private calcAmountInWithFee(
    amountOut: bigint,
    tokenIn: Token,
    tokenOut: Token,
    state: DeepReadonly<IntegralPoolState>,
    checkLimit: boolean = true,
  ) {
    if (amountOut === 0n) {
      return 0n;
    }
    const pair = this.findPair(tokenIn, tokenOut)
    if (!pair) {
      return 0n
    }
    const inverted = !this.isFirst(tokenIn.address, pair)
    if (checkLimit && !this.checkLimits(amountOut, this.isFirst(tokenOut.address, pair) ? state.limits0 : state.limits1)) {
      throw new Error('Out of Limits')
    }

    const price = inverted ? state.invertedPrice : state.price;
    const decimalsConverter = this.getDecimalsConverter(pair.token0.decimals, pair.token1.decimals, inverted);
    const amountIn = this.ceil_div(amountOut * decimalsConverter, price);
    if (amountIn <= 0n) {
      return 0n;
    }
    const amountInPlusFee = this.ceil_div(amountIn * PRECISION, PRECISION - state.fee);
    // const fee = amountInPlusFee - amountIn
    return amountInPlusFee;
  }

  private isFirst(address: string, pair: IntegralPair) {
    return address.toLowerCase() === pair.token0.address.toLowerCase()
  }

  private ceil_div(a: bigint, b: bigint) {
    const c = a / b;
    if (a != b * c) {
      return c + 1n;
    } else {
      return c;
    }
  }

  private getDecimalsConverter(decimals0: number, decimals1: number, inverted: boolean) {
    return 10n ** (18n + BigInt(inverted ? decimals1 - decimals0 : decimals0 - decimals1))
  }

  private checkLimits(amount: bigint, limits: readonly [bigint, bigint]) {
    if (amount < limits[0] || amount > limits[1]) {
      return false
    }
    return true
  }
}
