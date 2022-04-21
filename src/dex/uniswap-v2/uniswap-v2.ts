import { AbiCoder, Interface } from '@ethersproject/abi';
import _ from 'lodash';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  Log,
  Logger,
  PoolLiquidity,
  SimpleExchangeParam,
  Token,
  TxInfo,
} from '../../types';
import {
  UniswapData,
  UniswapDataLegacy,
  UniswapParam,
  UniswapPool,
  UniswapV2Data,
  UniswapV2Functions,
} from './types';
import { IDex } from '../idex';
import {
  ETHER_ADDRESS,
  MAX_UINT,
  Network,
  NULL_ADDRESS,
} from '../../constants';
import { SimpleExchange } from '../simple-exchange';
import { NumberAsString, SwapSide } from 'paraswap-core';
import { IDexHelper } from '../../dex-helper';
import {
  wrapETH,
  getDexKeysWithNetwork,
  isETHAddress,
  prependWithOx,
  WethMap,
} from '../../utils';
import uniswapV2ABI from '../../abi/uniswap-v2/uniswap-v2-pool.json';
import uniswapV2factoryABI from '../../abi/uniswap-v2/uniswap-v2-factory.json';
import ParaSwapABI from '../../abi/IParaswap.json';
import UniswapV2ExchangeRouterABI from '../../abi/UniswapV2ExchangeRouter.json';
import { Contract } from 'web3-eth-contract';
import { UniswapV2Config, Adapters } from './config';

const MAX_UINT_BIGINT = BigInt(MAX_UINT);
const RESERVE_LIMIT = BigInt(2) ** BigInt(112) - BigInt(1);

const DefaultUniswapV2PoolGasCost = 90 * 1000;

interface UniswapV2PoolOrderedParams {
  tokenIn: string;
  tokenOut: string;
  reservesIn: string;
  reservesOut: string;
  fee: string;
  direction: boolean;
  exchange: string;
}

export interface UniswapV2PoolState {
  reserves0: string;
  reserves1: string;
  feeCode: number;
}

const iface = new Interface(uniswapV2ABI);
const coder = new AbiCoder();

export const directUniswapFunctionName = [
  UniswapV2Functions.swapOnUniswap,
  UniswapV2Functions.buyOnUniswap,
  UniswapV2Functions.swapOnUniswapFork,
  UniswapV2Functions.buyOnUniswapFork,
  UniswapV2Functions.swapOnUniswapV2Fork,
  UniswapV2Functions.buyOnUniswapV2Fork,
];

export type UniswapV2Pair = {
  token0: Token;
  token1: Token;
  exchange?: Address;
  pool?: UniswapV2EventPool;
};

const subgraphTimeout = 10 * 1000;

export class UniswapV2EventPool extends StatefulEventSubscriber<UniswapV2PoolState> {
  decoder = (log: Log) => iface.parseLog(log);

  constructor(
    protected parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    private token0: Token,
    private token1: Token,
    // feeCode is ignored if DynamicFees is set to true
    private feeCode: number,
    logger: Logger,
    private dynamicFees = false,
    // feesMultiCallData is only used if dynamicFees is set to true
    private feesMultiCallEntry?: { target: Address; callData: string },
    private feesMultiCallDecoder?: (values: any[]) => number,
  ) {
    super(
      parentName +
        ' ' +
        (token0.symbol || token0.address) +
        '-' +
        (token1.symbol || token1.address) +
        ' pool',
      logger,
    );
  }

  protected processLog(
    state: DeepReadonly<UniswapV2PoolState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<UniswapV2PoolState> | null> {
    const event = this.decoder(log);
    switch (event.name) {
      case 'Sync':
        return {
          reserves0: event.args.reserve0.toString(),
          reserves1: event.args.reserve1.toString(),
          feeCode: state.feeCode,
        };
    }
    return null;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<UniswapV2PoolState>> {
    let calldata = [
      {
        target: this.poolAddress,
        callData: iface.encodeFunctionData('getReserves', []),
      },
    ];

    if (this.dynamicFees) {
      calldata.push(this.feesMultiCallEntry!);
    }

    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber);

    const decodedData = coder.decode(
      ['uint112', 'uint112', 'uint32'],
      data.returnData[0],
    );

    return {
      reserves0: decodedData[0].toString(),
      reserves1: decodedData[1].toString(),
      feeCode: this.dynamicFees
        ? this.feesMultiCallDecoder!(data.returnData[1])
        : this.feeCode,
    };
  }
}

export const UniswapV2ExchangeRouter: { [network: number]: Address } = {
  [Network.POLYGON]: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
  [Network.MAINNET]: '0xF9234CB08edb93c0d4a4d4c70cC3FfD070e78e07',
  [Network.ROPSTEN]: '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  [Network.BSC]: '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  [Network.AVALANCHE]: '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  [Network.FANTOM]: '0xAB86e2bC9ec5485a9b60E684BA6d49bf4686ACC2',
};

// Apply extra fee for certain tokens when used as input to swap (basis points)
// These could be tokens with fee on transfer or rounding error on balances
// Token addresses must be in lower case!
export const TOKEN_EXTRA_FEE: { [tokenAddress: string]: number } = {
  // stETH - uses balances based on shares which causes rounding errors
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 1,
  '0x8b3192f5eebd8579568a2ed41e6feb402f93f73f': 200,
};

function encodePools(pools: UniswapPool[]): NumberAsString[] {
  return pools.map(({ fee, direction, address }) => {
    return (
      (BigInt(10000 - fee) << BigInt(161)) +
      (BigInt(direction ? 0 : 1) << BigInt(160)) +
      BigInt(address)
    ).toString();
  });
}

export class UniswapV2
  extends SimpleExchange
  implements IDex<UniswapV2Data, UniswapParam>
{
  pairs: { [key: string]: UniswapV2Pair } = {};
  feeFactor = 10000;
  factory: Contract;

  routerInterface: Interface;
  exchangeRouterInterface: Interface;
  static directFunctionName = directUniswapFunctionName;

  logger: Logger;

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UniswapV2Config);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected isDynamicFees = false,
    protected factoryAddress: Address = UniswapV2Config[dexKey][network]
      .factoryAddress,
    protected subgraphURL: string | undefined = UniswapV2Config[dexKey] &&
      UniswapV2Config[dexKey][network].subgraphURL,
    protected initCode: string = UniswapV2Config[dexKey][network].initCode,
    // feeCode is ignored when isDynamicFees is set to true
    protected feeCode: number = UniswapV2Config[dexKey][network].feeCode,
    protected poolGasCost: number = (UniswapV2Config[dexKey] &&
      UniswapV2Config[dexKey][network].poolGasCost) ??
      DefaultUniswapV2PoolGasCost,
    protected adapters = (UniswapV2Config[dexKey] &&
      UniswapV2Config[dexKey][network].adapters) ??
      Adapters[network],
    protected router = (UniswapV2Config[dexKey] &&
      UniswapV2Config[dexKey][network].router) ??
      UniswapV2ExchangeRouter[network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);

    this.factory = new dexHelper.web3Provider.eth.Contract(
      uniswapV2factoryABI as any,
      factoryAddress,
    );

    this.routerInterface = new Interface(ParaSwapABI);
    this.exchangeRouterInterface = new Interface(UniswapV2ExchangeRouterABI);
  }

  // getFeesMultiCallData should be override
  // when isDynamicFees is set to true
  protected getFeesMultiCallData(poolAddress: Address):
    | undefined
    | {
        callEntry: { target: Address; callData: string };
        callDecoder: (values: any[]) => number;
      } {
    return undefined;
  }

  private async addPool(
    pair: UniswapV2Pair,
    reserves0: string,
    reserves1: string,
    feeCode: number,
    blockNumber: number,
  ) {
    const { callEntry, callDecoder } =
      this.getFeesMultiCallData(pair.exchange!) || {};
    pair.pool = new UniswapV2EventPool(
      this.dexKey,
      this.dexHelper,
      pair.exchange!,
      pair.token0,
      pair.token1,
      feeCode,
      this.logger,
      this.isDynamicFees,
      callEntry,
      callDecoder,
    );

    if (blockNumber)
      pair.pool.setState({ reserves0, reserves1, feeCode }, blockNumber);
    this.dexHelper.blockManager.subscribeToLogs(
      pair.pool,
      pair.exchange!,
      blockNumber,
    );
  }

  async getBuyPrice(
    priceParams: UniswapV2PoolOrderedParams,
    destAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut, fee } = priceParams;

    const numerator = BigInt(reservesIn) * destAmount * BigInt(this.feeFactor);
    const denominator =
      (BigInt(this.feeFactor) - BigInt(fee)) *
      (BigInt(reservesOut) - destAmount);

    if (denominator <= BigInt(0)) return MAX_UINT_BIGINT;
    return BigInt(1) + numerator / denominator;
  }

  async getSellPrice(
    priceParams: UniswapV2PoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut, fee } = priceParams;

    if (BigInt(reservesIn) + srcAmount > RESERVE_LIMIT) {
      return BigInt(0);
    }

    const amountInWithFee = srcAmount * BigInt(this.feeFactor - parseInt(fee));

    const numerator = amountInWithFee * BigInt(reservesOut);

    const denominator =
      BigInt(reservesIn) * BigInt(this.feeFactor) + amountInWithFee;

    return denominator === BigInt(0) ? BigInt(0) : numerator / denominator;
  }

  async getBuyPricePath(
    amount: bigint,
    params: UniswapV2PoolOrderedParams[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params.reverse()) {
      price = await this.getBuyPrice(param, price);
    }
    return price;
  }

  async getSellPricePath(
    amount: bigint,
    params: UniswapV2PoolOrderedParams[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params) {
      price = await this.getSellPrice(param, price);
    }
    return price;
  }

  private async findPair(from: Token, to: Token) {
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}`;
    let pair = this.pairs[key];
    if (pair) return pair;
    const exchange = await this.factory.methods
      .getPair(token0.address, token1.address)
      .call();
    if (exchange === NULL_ADDRESS) {
      pair = { token0, token1 };
    } else {
      pair = { token0, token1, exchange };
    }
    this.pairs[key] = pair;
    return pair;
  }

  async getManyPoolReserves(
    pairs: UniswapV2Pair[],
    blockNumber: number,
  ): Promise<UniswapV2PoolState[]> {
    try {
      const multiCallFeeData = pairs.map(pair =>
        this.getFeesMultiCallData(pair.exchange!),
      );

      const calldata = pairs
        .map((pair, i) => {
          let calldata = [
            {
              target: pair.exchange,
              callData: iface.encodeFunctionData('getReserves', []),
            },
          ];
          if (this.isDynamicFees) calldata.push(multiCallFeeData[i]!.callEntry);
          return calldata;
        })
        .flat();

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const returnData = _.chunk(data.returnData, this.isDynamicFees ? 2 : 1);
      return pairs.map((pair, i) => {
        const decodedData = coder.decode(
          ['uint112', 'uint112', 'uint32'],
          returnData[i][0],
        );

        return {
          reserves0: decodedData[0].toString(),
          reserves1: decodedData[1].toString(),
          feeCode: this.isDynamicFees
            ? multiCallFeeData[i]!.callDecoder(returnData[i][1])
            : this.feeCode,
        };
      });
    } catch (e) {
      this.logger.error(
        `Error_getManyPoolReserves could not get reserves with error:`,
        e,
      );
      return [];
    }
  }

  async batchCatchUpPairs(pairs: [Token, Token][], blockNumber: number) {
    if (!blockNumber) return;
    const pairsToFetch: UniswapV2Pair[] = [];
    for (const _pair of pairs) {
      const pair = await this.findPair(_pair[0], _pair[1]);
      if (!(pair && pair.exchange)) continue;
      if (!pair.pool) {
        pairsToFetch.push(pair);
      } else if (!pair.pool.getState(blockNumber)) {
        pairsToFetch.push(pair);
      }
    }

    if (!pairsToFetch.length) return;

    const reserves = await this.getManyPoolReserves(pairsToFetch, blockNumber);

    if (reserves.length !== pairsToFetch.length) {
      this.logger.error(
        `Error_getManyPoolReserves didn't get any pool reserves`,
      );
    }

    for (let i = 0; i < pairsToFetch.length; i++) {
      const pairState = reserves[i];
      const pair = pairsToFetch[i];
      if (!pair.pool) {
        await this.addPool(
          pair,
          pairState.reserves0,
          pairState.reserves1,
          pairState.feeCode,
          blockNumber,
        );
      } else pair.pool.setState(pairState, blockNumber);
    }
  }

  async getPairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
  ): Promise<UniswapV2PoolOrderedParams | null> {
    const pair = await this.findPair(from, to);
    if (!(pair && pair.pool && pair.exchange)) return null;
    const pairState = pair.pool.getState(blockNumber);
    if (!pairState) {
      this.logger.error(
        `Error_orderPairParams expected reserves, got none (maybe the pool doesn't exist) ${
          from.symbol || from.address
        } ${to.symbol || to.address}`,
      );
      return null;
    }
    const fee = (
      pairState.feeCode + (TOKEN_EXTRA_FEE[from.address.toLowerCase()] || 0)
    ).toString();
    const pairReversed =
      pair.token1.address.toLowerCase() === from.address.toLowerCase();
    if (pairReversed) {
      return {
        tokenIn: from.address,
        tokenOut: to.address,
        reservesIn: pairState.reserves1,
        reservesOut: pairState.reserves0,
        fee,
        direction: false,
        exchange: pair.exchange,
      };
    }
    return {
      tokenIn: from.address,
      tokenOut: to.address,
      reservesIn: pairState.reserves0,
      reservesOut: pairState.reserves1,
      fee,
      direction: true,
      exchange: pair.exchange,
    };
  }

  async getPoolIdentifiers(
    _from: Token,
    _to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const from = wrapETH(_from, this.network);
    const to = wrapETH(_to, this.network);

    if (from.address.toLowerCase() === to.address.toLowerCase()) {
      return [];
    }

    const tokenAddress = [from.address.toLowerCase(), to.address.toLowerCase()]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
    return [poolIdentifier];
  }

  async getPricesVolume(
    _from: Token,
    _to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    // list of pool identifiers to use for pricing, if undefined use all pools
    limitPools?: string[],
  ): Promise<ExchangePrices<UniswapV2Data> | null> {
    try {
      const from = wrapETH(_from, this.network);
      const to = wrapETH(_to, this.network);

      if (from.address.toLowerCase() === to.address.toLowerCase()) {
        return null;
      }

      const tokenAddress = [
        from.address.toLowerCase(),
        to.address.toLowerCase(),
      ]
        .sort((a, b) => (a > b ? 1 : -1))
        .join('_');

      const poolIdentifier = `${this.dexKey}_${tokenAddress}`;

      if (limitPools && limitPools.every(p => p !== poolIdentifier))
        return null;

      await this.batchCatchUpPairs([[from, to]], blockNumber);

      const pairParam = await this.getPairOrderedParams(from, to, blockNumber);

      if (!pairParam) return null;

      const unitAmount = BigInt(
        10 ** (side == SwapSide.BUY ? to.decimals : from.decimals),
      );
      const unit =
        side == SwapSide.BUY
          ? await this.getBuyPricePath(unitAmount, [pairParam])
          : await this.getSellPricePath(unitAmount, [pairParam]);

      const prices =
        side == SwapSide.BUY
          ? await Promise.all(
              amounts.map(amount => this.getBuyPricePath(amount, [pairParam])),
            )
          : await Promise.all(
              amounts.map(amount => this.getSellPricePath(amount, [pairParam])),
            );

      // As uniswapv2 just has one pool per token pair
      return [
        {
          prices: prices,
          unit: unit,
          data: {
            router: this.router,
            path: [from.address.toLowerCase(), to.address.toLowerCase()],
            factory: this.factoryAddress,
            initCode: this.initCode,
            feeFactor: this.feeFactor,
            pools: [
              {
                address: pairParam.exchange,
                fee: parseInt(pairParam.fee),
                direction: pairParam.direction,
              },
            ],
          },
          exchange: this.dexKey,
          poolIdentifier,
          gasCost: this.poolGasCost,
          poolAddresses: [pairParam.exchange],
        },
      ];
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.subgraphURL) return [];
    const query = `
      query ($token: Bytes!, $count: Int) {
        pools0: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token0: $token, reserve0_gt: 1, reserve1_gt: 1}) {
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
      pools1: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token1: $token, reserve0_gt: 1, reserve1_gt: 1}) {
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
        variables: { token: tokenAddress.toLowerCase(), count },
      },
      subgraphTimeout,
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

    const pools = _.slice(
      _.sortBy(_.concat(pools0, pools1), [pool => -1 * pool.liquidityUSD]),
      0,
      count,
    );

    return pools;
  }

  protected fixPath(path: Address[], srcToken: Address, destToken: Address) {
    return path.map((token: string, i: number) => {
      if (
        (i === 0 && srcToken.toLowerCase() === ETHER_ADDRESS.toLowerCase()) ||
        (i === path.length - 1 &&
          destToken.toLowerCase() === ETHER_ADDRESS.toLowerCase())
      )
        return ETHER_ADDRESS;
      return token;
    });
  }

  getWETHAddress(srcToken: Address, destToken: Address, weth?: Address) {
    if (!isETHAddress(srcToken) && !isETHAddress(destToken))
      return NULL_ADDRESS;
    return weth || WethMap[this.network];
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: UniswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const pools = encodePools(data.pools);
    const weth = this.getWETHAddress(srcToken, destToken, data.weth);
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          weth: 'address',
          pools: 'uint256[]',
        },
      },
      { pools, weth },
    );
    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const pools = encodePools(data.pools);
    const weth = this.getWETHAddress(src, dest, data.weth);
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      side === SwapSide.SELL ? UniswapV2Functions.swap : UniswapV2Functions.buy,
      [src, srcAmount, destAmount, weth, pools],
    );
    return this.buildSimpleParamWithoutWETHConversion(
      src,
      srcAmount,
      dest,
      destAmount,
      swapData,
      data.router,
    );
  }

  // TODO: Move to new uniswapv2&forks router interface
  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    _data: UniswapData,
    side: SwapSide,
    permit: string,
    contractMethod?: string,
  ): TxInfo<UniswapParam> {
    if (!contractMethod) throw new Error(`contractMethod need to be passed`);
    if (permit !== '0x') contractMethod += 'WithPermit';

    const swapParams = ((): UniswapParam => {
      const data = _data as unknown as UniswapDataLegacy;
      const path = this.fixPath(data.path, srcToken, destToken);

      switch (contractMethod) {
        case UniswapV2Functions.swapOnUniswap:
        case UniswapV2Functions.buyOnUniswap:
          return [srcAmount, destAmount, path];

        case UniswapV2Functions.swapOnUniswapFork:
        case UniswapV2Functions.buyOnUniswapFork:
          return [
            data.factory,
            prependWithOx(data.initCode),
            srcAmount,
            destAmount,
            path,
          ];

        case UniswapV2Functions.swapOnUniswapV2Fork:
        case UniswapV2Functions.buyOnUniswapV2Fork:
          return [
            srcToken,
            srcAmount,
            destAmount,
            this.getWETHAddress(srcToken, destToken, _data.weth),
            encodePools(_data.pools),
          ];

        case UniswapV2Functions.swapOnUniswapV2ForkWithPermit:
        case UniswapV2Functions.buyOnUniswapV2ForkWithPermit:
          return [
            srcToken,
            srcAmount,
            destAmount,
            this.getWETHAddress(srcToken, destToken, _data.weth),
            encodePools(_data.pools),
            permit,
          ];

        default:
          throw new Error(`contractMethod=${contractMethod} is not supported`);
      }
    })();

    const encoder = (...params: UniswapParam) =>
      this.routerInterface.encodeFunctionData(contractMethod!, params);
    return {
      params: swapParams,
      encoder,
      networkFee: '0',
    };
  }

  static getDirectFunctionName(): string[] {
    return this.directFunctionName;
  }
}
