import { AbiCoder, Interface } from '@ethersproject/abi';
import { pack } from '@ethersproject/solidity';
import _ from 'lodash';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import erc20ABI from '../../abi/erc20.json';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  PoolPrices,
  Log,
  Logger,
  PoolLiquidity,
  SimpleExchangeParam,
  Token,
  TxInfo,
  TransferFeeParams,
  DexExchangeParam,
} from '../../types';
import {
  RingData,
  RingDataLegacy,
  RingParam,
  RingPool,
  RingV2Data,
  RingV2Functions,
  RingV2FunctionsV6,
  RingV2ParamsDirect,
  RingV2ParamsDirectBase,
  RingV2PoolOrderedParams,
} from './types';
import { IDex } from '../idex';
import {
  DEST_TOKEN_PARASWAP_TRANSFERS,
  ETHER_ADDRESS,
  Network,
  NULL_ADDRESS,
  SRC_TOKEN_PARASWAP_TRANSFERS,
  SUBGRAPH_TIMEOUT,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { SimpleExchange } from '../simple-exchange';
import { NumberAsString, SwapSide } from '@paraswap/core';
import { IDexHelper } from '../../dex-helper';
import {
  getDexKeysWithNetwork,
  isETHAddress,
  prependWithOx,
  getBigIntPow,
  uuidToBytes16,
} from '../../utils';
//ringtodo
import ringV2ABI from '../../abi/ring-v2/uniswap-v2-pool.json';
import ringV2factoryABI from '../../abi/ring-v2/uniswap-v2-factory.json';
import ParaSwapABI from '../../abi/IParaswap.json';
import RingV2ExchangeRouterABI from '../../abi/RingV2ExchangeRouter.json';
import { Contract } from 'web3-eth-contract';
import { RingV2Config, Adapters } from './config';
import { Ringv2ConstantProductPool } from './ring-v2-constant-product-pool';
import { applyTransferFee } from '../../lib/token-transfer-fee';
import _rebaseTokens from '../../rebase-tokens.json';
import { Flag, SpecialDex } from '../../executor/types';
import {
  hexZeroPad,
  hexlify,
  solidityPack,
  hexDataLength,
  id,
  hexConcat,
} from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { computeFWTokenAddress, getFWTokenForToken } from './fw-token-helper';

const rebaseTokens = _rebaseTokens as { chainId: number; address: string }[];

const rebaseTokensSetsByChain = rebaseTokens.reduce<{
  [chainId: number]: Set<string>;
}>((acc, curr) => {
  if (!acc[curr.chainId]) {
    acc[curr.chainId] = new Set();
  }

  acc[curr.chainId].add(curr.address.toLowerCase());

  return acc;
}, {});

const DefaultRingV2PoolGasCost = 90 * 1000;

export const RESERVE_LIMIT = 2n ** 112n - 1n;

const LogCallTopics = [
  '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1', // event Sync(uint112 reserve0, uint112 reserve1) // uni-V2 and most forks
  '0xcf2aa50876cdfbb541206f89af0ee78d44a2abf8d328e37fa4917f982149848a', // event Sync(uint256 reserve0, uint256 reserve1) // commonly seen in solidly & forks
];

interface RingV2PoolState {
  reserves0: string;
  reserves1: string;
  feeCode: number;
}

const ringV2PoolIface = new Interface(ringV2ABI);
const erc20iface = new Interface(erc20ABI);
const coder = new AbiCoder();

export const directRingFunctionName = [
  RingV2Functions.swapOnRing,
  RingV2Functions.buyOnRing,
  RingV2Functions.swapOnRingFork,
  RingV2Functions.buyOnRingFork,
  RingV2Functions.swapOnRingV2Fork,
  RingV2Functions.buyOnRingV2Fork,
];

export const directRingFunctionNameV6 = [
  RingV2FunctionsV6.swap,
  RingV2FunctionsV6.buy,
];

export interface RingV2Pair {
  token0: Token;
  token1: Token;
  exchange?: Address;
  pool?: RingV2EventPool;
}

export class RingV2EventPool extends StatefulEventSubscriber<RingV2PoolState> {
  decoder = (log: Log) => this.iface.parseLog(log);

  constructor(
    parentName: string,
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
    private iface: Interface = ringV2PoolIface,
  ) {
    super(
      parentName,
      (token0.symbol || token0.address) +
        '-' +
        (token1.symbol || token1.address) +
        ' pool',
      dexHelper,
      logger,
    );
  }

  protected processLog(
    state: DeepReadonly<RingV2PoolState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<RingV2PoolState> | null> {
    if (!LogCallTopics.includes(log.topics[0])) return null;

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
  ): Promise<DeepReadonly<RingV2PoolState>> {
    let calldata = [
      {
        target: this.poolAddress,
        callData: this.iface.encodeFunctionData('getReserves', []),
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

function encodePools(pools: RingPool[], feeFactor: number): NumberAsString[] {
  return pools.map(({ fee, direction, address }) => {
    return (
      (BigInt(feeFactor - fee) << 161n) +
      ((direction ? 0n : 1n) << 160n) +
      BigInt(address)
    ).toString();
  });
}

export class RingV2
  extends SimpleExchange
  implements IDex<RingV2Data, RingParam | RingV2ParamsDirect>
{
  pairs: { [key: string]: RingV2Pair } = {};
  feeFactor = 10000;
  factory: Contract;

  routerInterface: Interface;
  exchangeRouterInterface: Interface;

  needWrapNative = true;

  logger: Logger;

  static directFunctionName = directRingFunctionName;
  static directFunctionNameV6 = directRingFunctionNameV6;

  readonly hasConstantPriceLargeAmounts = false;
  readonly isFeeOnTransferSupported: boolean = true;
  readonly SRC_TOKEN_DEX_TRANSFERS = 1;
  readonly DEST_TOKEN_DEX_TRANSFERS = 1;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(RingV2Config);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected isDynamicFees = false,
    protected factoryAddress: Address = RingV2Config[dexKey][network]
      .factoryAddress,
    protected subgraphURL: string | undefined = RingV2Config[dexKey] &&
      RingV2Config[dexKey][network].subgraphURL,
    protected initCode: string = RingV2Config[dexKey][network].initCode,
    // feeCode is ignored when isDynamicFees is set to true
    protected feeCode: number = RingV2Config[dexKey][network].feeCode,
    protected poolGasCost: number = (RingV2Config[dexKey] &&
      RingV2Config[dexKey][network].poolGasCost) ??
      DefaultRingV2PoolGasCost,
    protected decoderIface: Interface = ringV2PoolIface,
    protected adapters = (RingV2Config[dexKey] &&
      RingV2Config[dexKey][network].adapters) ??
      Adapters[network],
    protected router = (RingV2Config[dexKey] &&
      RingV2Config[dexKey][network].router) ??
      dexHelper.config.data.uniswapV2ExchangeRouterAddress,
    protected subgraphType:
      | 'subgraphs'
      | 'deployments'
      | undefined = RingV2Config[dexKey] &&
      RingV2Config[dexKey][network].subgraphType,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    this.factory = new dexHelper.web3Provider.eth.Contract(
      ringV2factoryABI as any,
      factoryAddress,
    );

    this.routerInterface = new Interface(ParaSwapABI);
    this.exchangeRouterInterface = new Interface(RingV2ExchangeRouterABI);
  }

  // getFeesMultiCallData should be override
  // when isDynamicFees is set to true
  protected getFeesMultiCallData(pair: RingV2Pair):
    | undefined
    | {
        callEntry: { target: Address; callData: string };
        callDecoder: (values: any[]) => number;
      } {
    return undefined;
  }

  protected async addPool(
    pair: RingV2Pair,
    reserves0: string,
    reserves1: string,
    feeCode: number,
    blockNumber: number,
  ) {
    const { callEntry, callDecoder } = this.getFeesMultiCallData(pair) || {};
    pair.pool = new RingV2EventPool(
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
      this.decoderIface,
    );
    pair.pool.addressesSubscribed.push(pair.exchange!);

    await pair.pool.initialize(blockNumber, {
      state: { reserves0, reserves1, feeCode },
    });
  }

  async getBuyPrice(
    priceParams: RingV2PoolOrderedParams,
    destAmount: bigint,
  ): Promise<bigint> {
    return Ringv2ConstantProductPool.getBuyPrice(
      priceParams,
      destAmount,
      this.feeFactor,
    );
  }

  async getSellPrice(
    priceParams: RingV2PoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    return Ringv2ConstantProductPool.getSellPrice(
      priceParams,
      srcAmount,
      this.feeFactor,
    );
  }

  async getBuyPricePath(
    amount: bigint,
    params: RingV2PoolOrderedParams[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params.reverse()) {
      price = await this.getBuyPrice(param, price);
    }
    return price;
  }

  async getSellPricePath(
    amount: bigint,
    params: RingV2PoolOrderedParams[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params) {
      price = await this.getSellPrice(param, price);
    }
    return price;
  }

  async findPair(from: Token, to: Token) {
    if (from.address.toLowerCase() === to.address.toLowerCase()) {
      return null;
    }
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}`;
    let pair = this.pairs[key];
    if (pair) {
      return pair;
    }
    // this.logger.debug('[findPair] factory and methods:', {
    //   factory: this.factory,
    //   methods: this.factory.methods,
    // });
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
    pairs: RingV2Pair[],
    blockNumber: number,
  ): Promise<RingV2PoolState[]> {
    try {
      const multiCallFeeData = pairs.map(pair =>
        this.getFeesMultiCallData(pair),
      );
      const calldata = pairs
        .map((pair, i) => {
          let calldata = [
            {
              target: pair.token0.address,
              callData: erc20iface.encodeFunctionData('balanceOf', [
                pair.exchange!,
              ]),
            },
            {
              target: pair.token1.address,
              callData: erc20iface.encodeFunctionData('balanceOf', [
                pair.exchange!,
              ]),
            },
          ];
          if (this.isDynamicFees) calldata.push(multiCallFeeData[i]!.callEntry);
          return calldata;
        })
        .flat();

      // const data: { returnData: any[] } =
      //   await this.dexHelper.multiContract.callStatic.aggregate(calldata, {
      //     blockTag: blockNumber,
      //   });

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const returnData = _.chunk(data.returnData, this.isDynamicFees ? 3 : 2);
      return pairs.map((pair, i) => ({
        reserves0: coder.decode(['uint256'], returnData[i][0])[0].toString(),
        reserves1: coder.decode(['uint256'], returnData[i][1])[0].toString(),
        feeCode: this.isDynamicFees
          ? multiCallFeeData[i]!.callDecoder(returnData[i][2])
          : this.feeCode,
      }));
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
    const pairsToFetch: RingV2Pair[] = [];
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
    tokenDexTransferFee: number,
  ): Promise<RingV2PoolOrderedParams | null> {
    const pair = await this.findPair(from, to);
    // console.log(`getPairOrderedParams.pair=${pair}`)
    if (!(pair && pair.pool && pair.exchange)) {
      this.logger.debug('Pair not found:', { pair });
      return null;
    }
    const pairState = pair.pool.getState(blockNumber);
    if (!pairState) {
      this.logger.debug('Pair State not found:', { pairState });
      this.logger.error(
        `Error_orderPairParams expected reserves, got none (maybe the pool doesn't exist) ${
          from.symbol || from.address
        } ${to.symbol || to.address}`,
      );
      return null;
    }
    const fee = (pairState.feeCode + tokenDexTransferFee).toString();
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
    // const from = this.dexHelper.config.wrapETH(_from);
    // const to = this.dexHelper.config.wrapETH(_to);

    const newSrcToken = this.dexHelper.config.wrapETH(_from);
    const newDestToken = this.dexHelper.config.wrapETH(_to);

    const from = getFWTokenForToken(newSrcToken, this.network);
    const to = getFWTokenForToken(newDestToken, this.network);

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
    transferFees: TransferFeeParams = {
      srcFee: 0,
      destFee: 0,
      srcDexFee: 0,
      destDexFee: 0,
    },
  ): Promise<ExchangePrices<RingV2Data> | null> {
    try {
      const newSrcToken = this.dexHelper.config.wrapETH(_from);
      const newDestToken = this.dexHelper.config.wrapETH(_to);

      const from = getFWTokenForToken(newSrcToken, this.network);
      const to = getFWTokenForToken(newDestToken, this.network);
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
      // console.log(`PriceVolume.poolIdentifier=${poolIdentifier}`)
      if (limitPools && limitPools.every(p => p !== poolIdentifier)) {
        this.logger.debug('Pool not in limitPools');
        return null;
      }

      await this.batchCatchUpPairs([[from, to]], blockNumber);
      const isSell = side === SwapSide.SELL;
      const pairParam = await this.getPairOrderedParams(
        from,
        to,
        blockNumber,
        transferFees.srcDexFee,
      );
      if (!pairParam) {
        this.logger.debug('No pair parameters found');
        return null;
      }

      const unitAmount = getBigIntPow(isSell ? from.decimals : to.decimals);

      const [unitVolumeWithFee, ...amountsWithFee] = applyTransferFee(
        [unitAmount, ...amounts],
        side,
        isSell ? transferFees.srcFee : transferFees.destFee,
        isSell ? SRC_TOKEN_PARASWAP_TRANSFERS : DEST_TOKEN_PARASWAP_TRANSFERS,
      );
      this.logger.debug(
        'Unit Volume With Fee:',
        unitVolumeWithFee,
        'isSell=',
        isSell,
      );
      const unit = isSell
        ? await this.getSellPricePath(unitVolumeWithFee, [pairParam])
        : await this.getBuyPricePath(unitVolumeWithFee, [pairParam]);

      const prices = isSell
        ? await Promise.all(
            amountsWithFee.map(amount =>
              this.getSellPricePath(amount, [pairParam]),
            ),
          )
        : await Promise.all(
            amountsWithFee.map(amount =>
              this.getBuyPricePath(amount, [pairParam]),
            ),
          );

      const [unitOutWithFee, ...outputsWithFee] = applyTransferFee(
        [unit, ...prices],
        side,
        // This part is confusing, because we treat differently SELL and BUY fees
        // If Buy, we should apply transfer fee on srcToken on top of dexFee applied earlier
        // But for Sell we should apply only one dexFee
        isSell ? transferFees.destDexFee : transferFees.srcFee,
        isSell ? this.DEST_TOKEN_DEX_TRANSFERS : SRC_TOKEN_PARASWAP_TRANSFERS,
      );

      // this.logger.debug(`Unit Out With Fee: ${unitOutWithFee}`);

      // this.logger.debug(
      //   `this.factoryAddress=${this.factoryAddress}. initCode=${this.initCode}`,
      // );
      // this.logger.debug(
      //   `this.router=${this.router}. pairParam.exchange=${pairParam.exchange}`,
      // );
      // As ringv2 just has one pool per token pair
      return [
        {
          prices: outputsWithFee,
          unit: unitOutWithFee,
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
      this.logger.debug('Error in getPricesVolume');

      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<RingV2Data>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> weth
      CALLDATA_GAS_COST.ADDRESS +
      // ParentStruct -> pools[] header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> pools[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> pools[0]
      CALLDATA_GAS_COST.wordNonZeroBytes(22)
    );
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters?.[side] ?? null;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.subgraphURL) {
      this.logger.error('Subgraph URL not set');
      return [];
    }
    // this.logger.debug(`Subgraph URL: ${this.subgraphURL}`);
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

    const { data } = await this.dexHelper.httpRequest.querySubgraph(
      this.subgraphURL,
      {
        query,
        variables: { token: tokenAddress.toLowerCase(), count },
      },
      { timeout: SUBGRAPH_TIMEOUT, type: this.subgraphType },
    );

    // this.logger.debug('Subgraph Data:', { data });
    // Commented logs removed as they were already commented out
    if (!(data && data.pools0 && data.pools1)) {
      this.logger.error('Subgraph query failed');
      throw new Error("Couldn't fetch the pools from the subgraph");
    }
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
      count,
    );
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
    return weth || this.dexHelper.config.data.wrappedNativeTokenAddress;
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: RingData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const pools = encodePools(data.pools, this.feeFactor);
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
    data: RingData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const pools = encodePools(data.pools, this.feeFactor);
    const weth = this.getWETHAddress(src, dest, data.weth);
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      side === SwapSide.SELL ? RingV2Functions.swap : RingV2Functions.buy,
      [src, srcAmount, destAmount, weth, pools],
    );

    const hasRebaseTokenSrc = rebaseTokensSetsByChain[this.network]?.has(
      src.toLowerCase(),
    );
    const hasRebaseTokenDest = rebaseTokensSetsByChain[this.network]?.has(
      dest.toLowerCase(),
    );

    const maybeSyncCall =
      hasRebaseTokenSrc || hasRebaseTokenDest
        ? {
            callees: [
              hasRebaseTokenSrc
                ? data.pools[0].address
                : data.pools[data.pools.length - 1].address,
            ],
            calldata: [ringV2PoolIface.encodeFunctionData('sync')],
            values: ['0'],
          }
        : undefined;

    return this.buildSimpleParamWithoutWETHConversion(
      src,
      srcAmount,
      dest,
      destAmount,
      swapData,
      data.router,
      data.router,
      '0',
      maybeSyncCall,
    );
  }

  // TODO: Rebase tokens handling?
  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: RingData,
    side: SwapSide,
  ): DexExchangeParam {
    // this.logger.debug(
    //   `getDexParam--->in. dexKey=${this.dexKey}. srcToken=${srcToken}.dstToken=${destToken}`,
    // );

    const pools = encodePools(data.pools, this.feeFactor);

    let exchangeData: string;
    let specialDexFlag: SpecialDex;
    let transferSrcTokenBeforeSwap: Address | undefined;
    let targetExchange: Address;
    let dexFuncHasRecipient: boolean;

    let ttl = 1200;
    const deadline = `0x${(
      Math.floor(new Date().getTime() / 1000) + ttl
    ).toString(16)}`;

    const RING_V2_DEX_KEY = 'RingV2' as const;
    if (this.dexKey !== RING_V2_DEX_KEY) {
      throw new Error(
        `Invalid dex key: ${this.dexKey}. Expected: ${RING_V2_DEX_KEY}`,
      );
    }

    const newSrcToken = this.dexHelper.config.wrapETH(srcToken);
    const newDestToken = this.dexHelper.config.wrapETH(destToken);

    const fwAddress = computeFWTokenAddress(newSrcToken, this.network);
    const fwAddress_to = computeFWTokenAddress(newDestToken, this.network);
    let path: Address[] = [fwAddress, fwAddress_to];
    //
    if (isETHAddress(srcToken)) {
      if (side == SwapSide.SELL) {
        exchangeData = this.exchangeRouterInterface.encodeFunctionData(
          RingV2Functions.swapExactETHForTokens,
          [destAmount, path, recipient, deadline],
        );
      } else {
        exchangeData = this.exchangeRouterInterface.encodeFunctionData(
          RingV2Functions.swapETHForExactTokens,
          [srcAmount, path, recipient, deadline],
        );
      }
    } else {
      if (side == SwapSide.SELL) {
        exchangeData = this.exchangeRouterInterface.encodeFunctionData(
          RingV2Functions.swapExactTokensForTokens,
          [srcAmount, destAmount, path, recipient, deadline],
        );
      } else {
        exchangeData = this.exchangeRouterInterface.encodeFunctionData(
          RingV2Functions.swapTokensForExactTokens,
          [destAmount, srcAmount, path, recipient, deadline],
        );
      }
    }

    specialDexFlag = SpecialDex.DEFAULT;
    // transferSrcTokenBeforeSwap
    targetExchange = data.router;
    dexFuncHasRecipient = true;

    return {
      needWrapNative: this.needWrapNative,
      specialDexSupportsInsertFromAmount: true,
      dexFuncHasRecipient,
      exchangeData,
      targetExchange,
      specialDexFlag,
      transferSrcTokenBeforeSwap,
      returnAmountPos: undefined,
    };

    /**
    const pools = encodePools(data.pools, this.feeFactor);
    
        this.logger.debug(`getDexParam.data==${data.router}, side=${side}`)
    
        let exchangeData: string;
        let specialDexFlag: SpecialDex;
        let transferSrcTokenBeforeSwap: Address | undefined;
        let targetExchange: Address;
        let dexFuncHasRecipient: boolean;
    
        // if (this.dexKey === 'BakerySwap') {
        //   const weth = this.getWETHAddress(srcToken, destToken, data.weth);
    
        //   exchangeData = this.exchangeRouterInterface.encodeFunctionData(
            // UniswapV2Functions.swap,
        //     [srcToken, srcAmount, destAmount, weth, pools],
        //   );
        //   specialDexFlag = SpecialDex.DEFAULT;
        //   targetExchange = data.router;
        //   dexFuncHasRecipient = false;
        // } else if (side === SwapSide.SELL) {
    
        // 这个 exchangeData 不是直接传给 pool 的 swap 方法的参数，而是传给 ParaSwap 的 Executor 合约的参数。
        if (side === SwapSide.SELL) {
          // 28 bytes are prepended in the Bytecode builder
          const exchangeDataTypes = ['bytes4', 'bytes32', 'bytes32'];
          const exchangeDataToPack = [
            hexZeroPad(hexlify(0), 4),
            hexZeroPad(hexlify(data.pools.length), 32), // pool count
            hexZeroPad(hexlify(BigNumber.from(srcAmount)), 32),
          ];
          pools.forEach(pool => {
            exchangeDataTypes.push('bytes32');
            exchangeDataToPack.push(hexZeroPad(hexlify(BigNumber.from(pool)), 32));
          });
    
          exchangeData = solidityPack(exchangeDataTypes, exchangeDataToPack);
          specialDexFlag = SpecialDex.SWAP_ON_UNISWAP_V2_FORK;
          transferSrcTokenBeforeSwap = data.pools[0].address;
          targetExchange = recipient;
          dexFuncHasRecipient = true;
        } else {
          const weth = this.getWETHAddress(srcToken, destToken, data.weth);
    
          exchangeData = this.exchangeRouterInterface.encodeFunctionData(
            RingV2Functions.buy,
            [srcToken, srcAmount, destAmount, weth, pools],
          );
          specialDexFlag = SpecialDex.DEFAULT;
          targetExchange = data.router;
          dexFuncHasRecipient = false;
        }
    
        return {
          needWrapNative: this.needWrapNative,
          specialDexSupportsInsertFromAmount: true,
          dexFuncHasRecipient,
          exchangeData,
          targetExchange,
          specialDexFlag,
          transferSrcTokenBeforeSwap,
          returnAmountPos: undefined,
        };
        */
  }

  // TODO: Move to new ringv2&forks router interface
  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    expectedAmount: NumberAsString,
    _data: RingData,
    side: SwapSide,
    permit: string,
    uuid: string,
    feePercent: NumberAsString,
    deadline: NumberAsString,
    partner: string,
    beneficiary: string,
    contractMethod: string,
  ): TxInfo<RingParam> {
    if (!contractMethod) throw new Error(`contractMethod need to be passed`);
    if (permit !== '0x') contractMethod += 'WithPermit';

    const swapParams = ((): RingParam => {
      const data = _data as unknown as RingDataLegacy;
      const path = this.fixPath(data.path, srcToken, destToken);

      switch (contractMethod) {
        case RingV2Functions.swapOnRing:
        case RingV2Functions.buyOnRing:
          return [srcAmount, destAmount, path];

        case RingV2Functions.swapOnRingFork:
        case RingV2Functions.buyOnRingFork:
          return [
            data.factory,
            prependWithOx(data.initCode),
            srcAmount,
            destAmount,
            path,
          ];

        case RingV2Functions.swapOnRingV2Fork:
        case RingV2Functions.buyOnRingV2Fork:
          return [
            srcToken,
            srcAmount,
            destAmount,
            this.getWETHAddress(srcToken, destToken, _data.weth),
            encodePools(_data.pools, this.feeFactor),
          ];

        case RingV2Functions.swapOnRingV2ForkWithPermit:
        case RingV2Functions.buyOnRingV2ForkWithPermit:
          return [
            srcToken,
            srcAmount,
            destAmount,
            this.getWETHAddress(srcToken, destToken, _data.weth),
            encodePools(_data.pools, this.feeFactor),
            permit,
          ];

        default:
          throw new Error(`contractMethod=${contractMethod} is not supported`);
      }
    })();

    const encoder = (...params: RingParam) =>
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

  getDirectParamV6(
    srcToken: Address,
    destToken: Address,
    fromAmount: NumberAsString,
    toAmount: NumberAsString,
    quotedAmount: NumberAsString,
    data: RingV2Data,
    side: SwapSide,
    permit: string,
    uuid: string,
    partnerAndFee: string,
    beneficiary: string,
    blockNumber: number,
    contractMethod: string,
  ) {
    if (!contractMethod) throw new Error(`contractMethod need to be passed`);
    if (!RingV2.getDirectFunctionNameV6().includes(contractMethod!)) {
      throw new Error(`Invalid contract method ${contractMethod}`);
    }

    const { path, pools } = data;
    const length = path.length;
    const encodedPath = path.reduce((acc, _, i) => {
      if (i >= length - 1) return acc;

      const p = this._encodePathV6(
        {
          srcToken: path[i],
          destToken: path[i + 1],
          direction: pools[i].direction,
        },
        side,
        data.wethAddress,
      ).replace('0x', '');

      return acc + p;
    }, '0x');

    const metadata = hexConcat([
      hexZeroPad(uuidToBytes16(uuid), 16),
      hexZeroPad(hexlify(blockNumber), 16),
    ]);

    const uniData: RingV2ParamsDirectBase = [
      srcToken,
      destToken,
      fromAmount,
      toAmount,
      quotedAmount,
      metadata,
      beneficiary,
      encodedPath,
    ];

    const swapParams: RingV2ParamsDirect = [uniData, partnerAndFee, permit];

    const encoder = (...params: (string | RingV2ParamsDirect)[]) => {
      return this.augustusV6Interface.encodeFunctionData(
        side === SwapSide.SELL ? RingV2FunctionsV6.swap : RingV2FunctionsV6.buy,
        [...params],
      );
    };

    return {
      params: swapParams,
      encoder,
      networkFee: '0',
    };
  }

  static getDirectFunctionNameV6(): string[] {
    return this.directFunctionNameV6;
  }

  // univ2 always had 1 pool per pair
  private _encodePathV6(
    path: {
      srcToken: Address;
      destToken: Address;
      direction: boolean;
    },
    side: SwapSide,
    weth?: Address,
  ): string {
    if (path == null) {
      this.logger.error(
        `${this.dexKey}: Received invalid path=${path} for side=${side} to encode`,
      );
      return '0x';
    }

    // v6 expects weth for eth in pools
    if (isETHAddress(path.srcToken)) {
      path.srcToken =
        weth || this.dexHelper.config.data.wrappedNativeTokenAddress;
    }

    if (isETHAddress(path.destToken)) {
      path.destToken =
        weth || this.dexHelper.config.data.wrappedNativeTokenAddress;
    }

    // contract expects tokens to be sorted, and direction switched in case sorting changes src/dest order
    const [srcTokenSorted, destTokenSorted] =
      BigInt(path.srcToken) > BigInt(path.destToken)
        ? [path.destToken, path.srcToken]
        : [path.srcToken, path.destToken];

    const direction = srcTokenSorted === path.srcToken ? 1 : 0;

    const tokensEncoded = pack(
      ['address', 'address'],
      [srcTokenSorted, destTokenSorted],
    );
    return tokensEncoded + '0'.repeat(47) + direction;
  }
}
