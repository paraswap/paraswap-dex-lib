import { AbiCoder, Interface } from '@ethersproject/abi';
import { BigNumber } from 'ethers';
import _ from 'lodash';
import { DeepReadonly, AsyncOrSync } from 'ts-essentials';
import { Contract } from 'web3-eth-contract';
import {
  DEST_TOKEN_PARASWAP_TRANSFERS,
  ETHER_ADDRESS,
  NULL_ADDRESS,
  Network,
  SRC_TOKEN_PARASWAP_TRANSFERS,
  SwapSide,
} from '../../constants';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  Log,
  Logger,
  NumberAsString,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
  TransferFeeParams,
  TxInfo,
} from '../../types';
import { IDexHelper } from '../../dex-helper/index';
import {
  SmardexPair,
  SmardexPool,
  SmardexPoolOrderedParams,
  SmardexPoolState,
} from './types';
import {
  getBigIntPow,
  getDexKeysWithNetwork,
  isETHAddress,
  prependWithOx,
} from '../../utils';
import SmardexFactoryLayerOneABI from '../../abi/smardex/layer-1/smardex-factory.json';
import SmardexFactoryLayerTwoABI from '../../abi/smardex/layer-2/smardex-factory.json';
import SmardexPoolLayerOneABI from '../../abi/smardex/layer-1/smardex-pool.json';
import SmardexPoolLayerTwoABI from '../../abi/smardex/layer-2/smardex-pool.json';
import SmardexRouterABI from '../../abi/smardex/all/smardex-router.json';
import { SimpleExchange } from '../simple-exchange';
import { SmardexData, SmardexRouterFunctions } from '../smardex/types';
import { IDex, StatefulEventSubscriber } from '../..';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { Adapters, SmardexConfig } from './config';
import ParaSwapABI from '../../abi/IParaswap.json';
import {
  UniswapDataLegacy,
  UniswapParam,
  UniswapV2Functions,
} from '../uniswap-v2/types';
import { applyTransferFee } from '../../lib/token-transfer-fee';
import { getAmountIn, getAmountOut } from './smardex-sdk';

// event Sync (uint256 reserve0, uint256 reserve1, uint256 fictiveReserve0, uint256 fictiveReserve1, uint256 priceAverage0, uint256 priceAverage1)
export const SYNC_EVENT_TOPIC =
  '0x2a368c7f33bb86e2d999940a3989d849031aff29b750f67947e6b8e8c3d2ffd6';

const DefaultSmardexPoolGasCost = 90 * 1000;

const smardexPoolL1 = new Interface(SmardexPoolLayerOneABI);
const smardexPoolL2 = new Interface(SmardexPoolLayerTwoABI);

const coder = new AbiCoder();

const directSmardexFunctionName = [
  SmardexRouterFunctions.sellExactEth,
  SmardexRouterFunctions.sellExactToken,
  SmardexRouterFunctions.swapExactIn,
  SmardexRouterFunctions.buyExactEth,
  SmardexRouterFunctions.buyExactToken,
  SmardexRouterFunctions.swapExactOut,
];

export class SmardexEventPool extends StatefulEventSubscriber<SmardexPoolState> {
  constructor(
    protected poolInterface: Interface,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    token0: Token,
    token1: Token,
    logger: Logger,
    protected smardexFeesMultiCallEntry?: {
      target: string;
      callData: string;
    },
    protected smardexFeesMulticallDecoder?: (values: any[]) => number,
  ) {
    super(
      'Smardex',
      (token0.symbol || token0.address) +
        '-' +
        (token1.symbol || token1.address) +
        ' pool',
      dexHelper,
      logger,
    );
  }

  protected processLog(
    state: DeepReadonly<SmardexPoolState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<SmardexPoolState> | null> {
    if (log.topics[0] !== SYNC_EVENT_TOPIC) return null;
    const event = smardexPoolL1.parseLog(log);
    switch (event.name) {
      case 'Sync':
        return {
          reserves0: event.args.reserve0.toString(),
          reserves1: event.args.reserve1.toString(),
          fictiveReserves0: event.args.fictiveReserve0.toString(),
          fictiveReserves1: event.args.fictiveReserve1.toString(),
          priceAverage0: event.args.priceAverage0.toString(),
          priceAverage1: event.args.priceAverage1.toString(),
          priceAverageLastTimestamp: state.priceAverageLastTimestamp, // should be updated but only on Swap event
          feeCode: state.feeCode,
        };
    }
    return null;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<SmardexPoolState>> {
    const coder = new AbiCoder();
    const dynamicFees = !!this.smardexFeesMultiCallEntry;
    let calldata = [
      {
        target: this.poolAddress,
        callData: this.poolInterface.encodeFunctionData('getReserves', []),
      },
      {
        target: this.poolAddress,
        callData: this.poolInterface.encodeFunctionData(
          'getFictiveReserves',
          [],
        ),
      },

      {
        target: this.poolAddress,
        callData: this.poolInterface.encodeFunctionData('getPriceAverage', []),
      },
    ];
    if (dynamicFees) {
      calldata.push(this.smardexFeesMultiCallEntry!);
    }

    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber);

    const [reserves0, reserves1] = coder.decode(
      ['uint256', 'uint256'],
      data.returnData[0],
    );

    const [fictiveReserve0, fictiveReserve1] = coder.decode(
      ['uint256', 'uint256'],
      data.returnData[1],
    );

    const [priceAverage0, priceAverage1, priceAverageLastTimestamp] = coder.decode(
      ['uint256', 'uint256', 'uint256'],
      data.returnData[2],
    );

    return {
      reserves0: reserves0.toString(),
      reserves1: reserves1.toString(),
      fictiveReserves0: fictiveReserve0.toString(),
      fictiveReserves1: fictiveReserve1.toString(),
      priceAverage0: priceAverage0.toString(),
      priceAverage1: priceAverage1.toString(),
      priceAverageLastTimestamp: priceAverageLastTimestamp.toNumber(),
      feeCode: dynamicFees
        ? this.smardexFeesMulticallDecoder!(data.returnData[3])
        : 700, // TODO: Ensure the fees are correct
    };
  }
}

function encodePools(
  pools: SmardexPool[],
  feeFactor: number,
): NumberAsString[] {
  return pools.map(({ fee, direction, address }) => {
    return (
      (BigInt(feeFactor - fee) << 161n) +
      ((direction ? 0n : 1n) << 160n) +
      BigInt(address)
    ).toString();
  });
}

export class Smardex
  extends SimpleExchange
  implements IDex<SmardexData, UniswapParam>
{
  pairs: { [key: string]: SmardexPair } = {};
  feeFactor = 10000;
  factory: Contract;

  routerInterface: Interface;
  exchangeRouterInterface: Interface;
  static directFunctionName = directSmardexFunctionName;

  factoryAddress: string;
  routerAddress: string;

  initCode: string;

  logger: Logger;

  readonly hasConstantPriceLargeAmounts = false;
  readonly isFeeOnTransferSupported: boolean = true;
  readonly SRC_TOKEN_DEX_TRANSFERS = 1;
  readonly DEST_TOKEN_DEX_TRANSFERS = 1;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SmardexConfig);

  constructor(
    protected network: Network,
    dexKey: string,
    public dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    const config = SmardexConfig[dexKey];
    this.routerAddress = config[network].router!;
    this.factoryAddress = config[network].factoryAddress;
    this.initCode = config[network].initCode;
    const factoryAbi = this.isLayer1()
      ? SmardexFactoryLayerOneABI
      : SmardexFactoryLayerTwoABI;
    this.factory = new dexHelper.web3Provider.eth.Contract(
      factoryAbi as any,
      this.factoryAddress,
    );
    this.routerInterface = new Interface(ParaSwapABI);
    this.exchangeRouterInterface = new Interface(SmardexRouterABI);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return Adapters[this.network]?.[side] || null;
  }

  async getPoolIdentifiers(
    _from: Token,
    _to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const from = this.dexHelper.config.wrapETH(_from);
    const to = this.dexHelper.config.wrapETH(_to);

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
  ): Promise<ExchangePrices<SmardexData> | null> {
    try {
      const from = this.dexHelper.config.wrapETH(_from);
      const to = this.dexHelper.config.wrapETH(_to);

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
      const isSell = side === SwapSide.SELL;
      const pairParam = await this.getPairOrderedParams(
        from,
        to,
        blockNumber,
        transferFees.srcDexFee,
      );

      if (!pairParam) return null;

      const unitAmount = getBigIntPow(isSell ? from.decimals : to.decimals);

      const [unitVolumeWithFee, ...amountsWithFee] = applyTransferFee(
        [unitAmount, ...amounts],
        side,
        isSell ? transferFees.srcFee : transferFees.destFee,
        isSell ? SRC_TOKEN_PARASWAP_TRANSFERS : DEST_TOKEN_PARASWAP_TRANSFERS,
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

      // As uniswapv2 just has one pool per token pair
      return [
        {
          prices: outputsWithFee,
          unit: unitOutWithFee,
          data: {
            deadline: 3387835836, // TODO make deadline and receiver dynamic !
            receiver: this.augustusAddress,
            router: this.routerAddress,
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
          gasCost: DefaultSmardexPoolGasCost,
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

  async getBuyPricePath(
    amount: bigint,
    params: SmardexPoolOrderedParams[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params.reverse()) {
      price = await this.getBuyPrice(param, price);
    }
    return price;
  }

  async getSellPricePath(
    amount: bigint,
    params: SmardexPoolOrderedParams[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params) {
      price = await this.getSellPrice(param, price);
    }
    return price;
  }

  async getBuyPrice(
    priceParams: SmardexPoolOrderedParams,
    destAmount: bigint,
  ): Promise<bigint> {
    const amountIn = getAmountIn(
      BigNumber.from(destAmount),
      BigNumber.from(priceParams.reservesIn),
      BigNumber.from(priceParams.reservesOut),
      BigNumber.from(priceParams.fictiveReservesIn),
      BigNumber.from(priceParams.fictiveReservesOut),
      BigNumber.from(priceParams.priceAverageIn),
      BigNumber.from(priceParams.priceAverageOut),
    )[0];
    return BigInt(amountIn.toString());
  }

  async getSellPrice(
    priceParams: SmardexPoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    const amountOut = getAmountOut(
      BigNumber.from(srcAmount),
      BigNumber.from(priceParams.reservesIn),
      BigNumber.from(priceParams.reservesOut),
      BigNumber.from(priceParams.fictiveReservesIn),
      BigNumber.from(priceParams.fictiveReservesOut),
      BigNumber.from(priceParams.priceAverageIn),
      BigNumber.from(priceParams.priceAverageOut),
    )[0];
    return BigInt(amountOut.toString());
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(_poolPrices: PoolPrices<SmardexData>): number | number[] {
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

  async findPair(from: Token, to: Token) {
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

  async batchCatchUpPairs(pairs: [Token, Token][], blockNumber: number) {
    if (!blockNumber) return;
    const pairsToFetch: SmardexPair[] = [];
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
          pairState.fictiveReserves0,
          pairState.fictiveReserves1,
          pairState.priceAverage0,
          pairState.priceAverage1,
          pairState.feeCode,
          blockNumber,
          pairState.priceAverageLastTimestamp,
        );
      } else pair.pool.setState(pairState, blockNumber);
    }
  }

  // On Smardex the fees are upgradable on layer 2.
  protected getFeesMultiCallData(pair: SmardexPair) {
    if (this.isLayer1()) {
      return null;
    }
    const callEntry = {
      target: pair.exchange!,
      callData: smardexPoolL2.encodeFunctionData('getPairFees'),
    };
    const callDecoder = (values: any[]) =>
      parseInt(
        smardexPoolL2.decodeFunctionResult('getPairFees', values)[0].toString(),
      );

    return {
      callEntry,
      callDecoder,
    };
  }

  protected async addPool(
    pair: SmardexPair,
    reserves0: string,
    reserves1: string,
    fictiveReserves0: string,
    fictiveReserves1: string,
    priceAverage0: string,
    priceAverage1: string,
    feeCode: number,
    blockNumber: number,
    priceAverageLastTimestamp?: number,
  ) {
    const multiCallFeeData = this.getFeesMultiCallData(pair);
    pair.pool = new SmardexEventPool(
      this.isLayer1() ? smardexPoolL1 : smardexPoolL2,
      this.dexHelper,
      pair.exchange!,
      pair.token0,
      pair.token1,
      this.logger,
      // For layer 2 we need to fetch the fees
      multiCallFeeData?.callEntry,
      multiCallFeeData?.callDecoder,
    );
    pair.pool.addressesSubscribed.push(pair.exchange!);

    await pair.pool.initialize(blockNumber, {
      state: {
        reserves0,
        reserves1,
        fictiveReserves0,
        fictiveReserves1,
        priceAverage0,
        priceAverage1,
        feeCode,
        priceAverageLastTimestamp,
      },
    });
  }

  async getManyPoolReserves(
    pairs: SmardexPair[],
    blockNumber: number,
  ): Promise<SmardexPoolState[]> {
    try {
      const multiCallFeeData = pairs.map(pair =>
        this.getFeesMultiCallData(pair),
      );
      const calldata = pairs
        .map((pair, i) => {
          let calldata = [
            {
              target: pair.exchange!,
              callData: smardexPoolL1.encodeFunctionData('getReserves'),
            },
            {
              target: pair.exchange!,
              callData: smardexPoolL1.encodeFunctionData('getFictiveReserves'),
            },
            {
              target: pair.exchange!,
              callData: smardexPoolL1.encodeFunctionData('getPriceAverage'),
            },
          ];
          // Fetch fees only on layer 2
          !this.isLayer1() && calldata.push(multiCallFeeData[i]!.callEntry);
          return calldata;
        })
        .flat();

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const returnData = _.chunk(data.returnData, 3);
      return pairs.map((_pair: SmardexPair, i) => ({
        reserves0: coder
          .decode(['uint256', 'uint256'], returnData[i][0])[0]
          .toString(),
        reserves1: coder
          .decode(['uint256', 'uint256'], returnData[i][0])[1]
          .toString(),
        fictiveReserves0: coder
          .decode(['uint256', 'uint256'], returnData[i][1])[0]
          .toString(),
        fictiveReserves1: coder
          .decode(['uint256', 'uint256'], returnData[i][1])[1]
          .toString(),
        priceAverage0: coder
          .decode(['uint256', 'uint256', 'uint256'], returnData[i][2])[0]
          .toString(),
        priceAverage1: coder
          .decode(['uint256', 'uint256', 'uint256'], returnData[i][2])[1]
          .toString(),
        priceAverageLastTimestamp: coder
          .decode(['uint256', 'uint256', 'uint256'], returnData[i][2])[2]
          .toString(),
        feeCode: this.isLayer1()
          ? 700
          : multiCallFeeData[i]!.callDecoder(returnData[i][3]),
      }));
    } catch (e) {
      this.logger.error(
        `Error_getManyPoolReserves could not get reserves with error:`,
        e,
      );
      return [];
    }
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

  // Necessary to get the correct path for the router
  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    expectedAmount: NumberAsString,
    _data: SmardexData,
    side: SwapSide,
    permit: string,
    uuid: string,
    feePercent: NumberAsString,
    deadline: NumberAsString,
    partner: string,
    beneficiary: string,
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
            this.getWETHAddress(srcToken, destToken, _data.wethAddress),
            encodePools(_data.pools, this.feeFactor),
          ];

        case UniswapV2Functions.swapOnUniswapV2ForkWithPermit:
        case UniswapV2Functions.buyOnUniswapV2ForkWithPermit:
          return [
            srcToken,
            srcAmount,
            destAmount,
            this.getWETHAddress(srcToken, destToken, _data.wethAddress),
            encodePools(_data.pools, this.feeFactor),
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

  async getPairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
    tokenDexTransferFee: number,
  ): Promise<SmardexPoolOrderedParams | null> {
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
    const fee = (pairState.feeCode + tokenDexTransferFee).toString();
    const pairReversed =
      pair.token1.address.toLowerCase() === from.address.toLowerCase();
    if (pairReversed) {
      return {
        tokenIn: from.address,
        tokenOut: to.address,
        reservesIn: pairState.reserves1,
        reservesOut: pairState.reserves0,
        fictiveReservesIn: pairState.fictiveReserves1,
        fictiveReservesOut: pairState.fictiveReserves0,
        priceAverageIn: pairState.priceAverage0,
        priceAverageOut: pairState.priceAverage1,
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
      fictiveReservesIn: pairState.fictiveReserves0,
      fictiveReservesOut: pairState.fictiveReserves1,
      priceAverageIn: pairState.priceAverage0,
      priceAverageOut: pairState.priceAverage1,
      fee,
      direction: true,
      exchange: pair.exchange,
    };
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: SmardexData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const pools = encodePools(data.pools, this.feeFactor);
    const weth = this.getWETHAddress(srcToken, destToken, data.wethAddress);
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

  getWETHAddress(srcToken: Address, destToken: Address, weth?: Address) {
    if (!isETHAddress(srcToken) && !isETHAddress(destToken))
      return NULL_ADDRESS;
    return weth || this.dexHelper.config.data.wrappedNativeTokenAddress;
  }

  async getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: SmardexData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const pools = encodePools(data.pools, this.feeFactor);
    const weth = this.getWETHAddress(src, dest, data.wethAddress);

    let routerMethod: any;
    let routerArgs: any;
    if (side === SwapSide.SELL) {
      routerMethod = isETHAddress(src) ? SmardexRouterFunctions.sellExactEth : SmardexRouterFunctions.swapExactIn;
      routerMethod = isETHAddress(dest) ? SmardexRouterFunctions.sellExactToken : routerMethod;
      routerArgs = [srcAmount, destAmount, data.path, data.receiver, data.deadline];
    } else {
      routerMethod = isETHAddress(src) ? SmardexRouterFunctions.buyExactToken : SmardexRouterFunctions.swapExactOut;
      routerMethod = isETHAddress(dest) ? SmardexRouterFunctions.buyExactEth : routerMethod;
      routerArgs = [destAmount, srcAmount, data.path, data.receiver, data.deadline];
    }

    const swapData = this.exchangeRouterInterface.encodeFunctionData(routerMethod, routerArgs);
    return this.buildSimpleParamWithoutWETHConversion(
      src,
      srcAmount,
      dest,
      destAmount,
      swapData,
      data.router,
    );
  }

  isLayer1(): boolean {
    return this.network === Network.MAINNET;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: Complete with a query on our subgraph gateway
    return [];
  }
}
