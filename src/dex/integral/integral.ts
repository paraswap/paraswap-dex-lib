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
import {
  _require,
  getBigIntPow,
  getDexKeysWithNetwork,
  isETHAddress,
} from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  IntegralData,
  IntegralFunctions,
  PoolStates,
  QuotingProps,
  RelayerPoolState,
  RelayerTokensState,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { IntegralConfig, Adapters } from './config';
import IntegralRelayerABI from '../../abi/integral/relayer.json';
import { Interface } from '@ethersproject/abi';
import { BI_POWS } from '../../bigint-constants';
import {
  getDecimalsConverter,
  getPoolIdentifier,
  getPrice,
  isInverted,
} from './helpers';
import { ceil_div, sortTokens } from './utils';
import { IntegralContext } from './context';

const PRECISION = BI_POWS[18];
const SUBGRAPH_TIMEOUT = 20 * 1000;
const relayerInterface = new Interface(IntegralRelayerABI);

export class Integral extends SimpleExchange implements IDex<IntegralData> {
  protected subgraphURL: string | undefined;
  readonly hasConstantPriceLargeAmounts = false;

  private readonly context: IntegralContext;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(IntegralConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    this.context = IntegralContext.initialize(
      network,
      dexKey,
      dexHelper,
      this.erc20Interface,
      IntegralConfig[dexKey][network].factoryAddress.toLowerCase(),
      IntegralConfig[dexKey][network].relayerAddress.toLowerCase(),
    );
    this.subgraphURL = IntegralConfig[dexKey][network].subgraphURL;
  }

  async initializePricing(blockNumber: number) {
    await this.context.factory.initialize(blockNumber);
    const factoryState = this.context.factory.getState(blockNumber);
    if (factoryState) {
      await this.context.addPools(factoryState.pools, blockNumber, true);
    }
  }

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

    const tokenAddresses = [
      src.address.toLowerCase(),
      dest.address.toLowerCase(),
    ]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddresses}`;
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

    const poolIdentifier = getPoolIdentifier(
      this.dexKey,
      src.address,
      dest.address,
    );
    if (limitPools && limitPools.every(p => p !== poolIdentifier)) {
      return null;
    }

    const props = await this.getQuotingProps(src, dest, blockNumber);
    if (!props) {
      return null;
    }

    const unitAmount = getBigIntPow(
      side == SwapSide.SELL ? src.decimals : dest.decimals,
    );
    const unit =
      side == SwapSide.SELL
        ? this.quoteSell(unitAmount, props, false)
        : this.quoteBuy(unitAmount, props, false);
    try {
      const prices =
        side == SwapSide.SELL
          ? amounts.map(amount => this.quoteSell(amount, props))
          : amounts.map(amount => this.quoteBuy(amount, props));

      return [
        {
          prices: prices,
          unit: unit,
          data: {
            relayer: this.context.relayerAddress,
          },
          exchange: this.dexKey,
          poolIdentifier,
          gasCost: 0,
          poolAddresses: this.context.getPoolAddresses(),
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
  getCalldataGasCost(poolPrices: PoolPrices<IntegralData>): number | number[] {
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
      side === SwapSide.SELL ? IntegralFunctions.swap : IntegralFunctions.buy,
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

  async updatePoolState(): Promise<void> {}

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

  async getPriceOnChain(
    tokenIn: Token,
    tokenOut: Token,
    inverted: boolean,
    blockNumber: number,
  ): Promise<QuotingProps | null> {
    try {
      const calldata = [
        {
          target: this.context.relayerAddress,
          callData: relayerInterface.encodeFunctionData('getPoolState', [
            tokenIn.address,
            tokenOut.address,
          ]),
        },
      ];
      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const result = relayerInterface.decodeFunctionResult(
        'getPoolState',
        data.returnData[0],
      );
      const _limits = inverted
        ? [result.limitMin1, result.limitMax1]
        : [result.limitMin0, result.limitMax0];
      const limits: [bigint, bigint] = [
        BigInt(_limits[0].toString()),
        BigInt(_limits[1].toString()),
      ];
      const [decimals0, decimals1] = inverted
        ? [tokenOut.decimals, tokenIn.decimals]
        : [tokenIn.decimals, tokenOut.decimals];
      return {
        price: BigInt(result.price.toString()),
        fee: BigInt(result.fee.toString()),
        tokenOutLimits: limits,
        decimalsConverter: getDecimalsConverter(decimals0, decimals1, inverted),
      };
    } catch (e) {
      this.logger.error(
        `Error_getPriceOnChain could not get data with error:`,
        e,
      );
      return null;
    }
  }

  private async getQuotingProps(src: Token, dest: Token, blockNumber: number) {
    const poolId = getPoolIdentifier(this.dexKey, src.address, dest.address);
    const inverted = isInverted(src.address, dest.address);

    const states = this.getStates(poolId, blockNumber);
    if (!states) {
      return await this.getPriceOnChain(src, dest, inverted, blockNumber);
    }
    const { base, poolAddress, relayer, relayerTokens } = states;

    const price = getPrice(states, inverted);

    const token0 = sortTokens(src.address, dest.address)[0];
    const { max0, max1 } = this.getMaxLimits(
      poolAddress,
      relayer,
      relayerTokens,
    );
    const props: QuotingProps = {
      price,
      fee: relayer.swapFee,
      tokenOutLimits:
        dest.address === token0
          ? [relayer.limits.min0, max0]
          : [relayer.limits.min1, max1],
      decimalsConverter: getDecimalsConverter(
        base.decimals0,
        base.decimals1,
        inverted,
      ),
    };
    return props;
  }

  private quoteSell(
    amountIn: bigint,
    props: DeepReadonly<QuotingProps>,
    checkLimit: boolean = true,
  ) {
    if (amountIn === 0n) {
      return 0n;
    }

    const fee = (amountIn * props.fee) / PRECISION;
    const amountInMinusFee = amountIn - fee;
    const amountOut =
      (amountInMinusFee * props.price) / props.decimalsConverter;
    if (checkLimit && !this.checkLimits(amountOut, props.tokenOutLimits)) {
      throw new Error(
        `Out of Limits - amountOut ${amountOut} not in between limits ${props.tokenOutLimits}`,
      );
    }
    return amountOut;
  }

  private quoteBuy(
    amountOut: bigint,
    props: DeepReadonly<QuotingProps>,
    checkLimit: boolean = true,
  ) {
    if (amountOut === 0n) {
      return 0n;
    }

    if (checkLimit && !this.checkLimits(amountOut, props.tokenOutLimits)) {
      throw new Error(
        `Out of Limits - amountOut ${amountOut} not in between limits ${props.tokenOutLimits}`,
      );
    }

    const amountIn = ceil_div(amountOut * props.decimalsConverter, props.price);
    if (amountIn <= 0n) {
      return 0n;
    }
    const amountInPlusFee = ceil_div(
      amountIn * PRECISION,
      PRECISION - props.fee,
    );
    return amountInPlusFee;
  }

  private checkLimits(amount: bigint, limits: readonly [bigint, bigint]) {
    if (amount < limits[0] || amount > limits[1]) {
      return false;
    }
    return true;
  }

  private getStates(poolId: string, blockNumber: number): PoolStates | null {
    const poolStates = this.context.pools[poolId];
    if (poolStates.base) {
      const base = poolStates.base.getState(blockNumber);
      const pricing =
        poolStates.pricing && poolStates.pricing.getState(blockNumber);
      const relayerState = this.context.relayer.getState(blockNumber);
      const relayer =
        relayerState && relayerState.pools[poolStates.base.poolAddress];
      return base && pricing && relayer
        ? {
            base,
            pricing,
            relayer,
            relayerTokens: relayerState.tokens,
            poolAddress: poolStates.base.poolAddress,
          }
        : null;
    } else {
      return null;
    }
  }

  private getMaxLimits(
    poolAddress: Address,
    relayer: RelayerPoolState,
    relayerTokens: RelayerTokensState,
  ) {
    const { token0, token1 } =
      this.context.relayer.getPools()[poolAddress.toLowerCase()];
    const max0 =
      (relayerTokens[token0].balance * relayer.limits.maxMultiplier0) /
      10n ** 18n;
    const max1 =
      (relayerTokens[token1].balance * relayer.limits.maxMultiplier1) /
      10n ** 18n;
    return { max0, max1 };
  }
}
