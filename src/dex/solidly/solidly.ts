import { UniswapV2 } from '../uniswap-v2/uniswap-v2';
import { Network, NULL_ADDRESS, SUBGRAPH_TIMEOUT } from '../../constants';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  PoolLiquidity,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { IDexHelper } from '../../dex-helper';
import erc20ABI from '../../abi/erc20.json';
import { UniswapData, UniswapV2Data } from '../uniswap-v2/types';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import solidlyFactoryABI from '../../abi/solidly/SolidlyFactory.json';
import solidlyPair from '../../abi/solidly/SolidlyPair.json';
import _ from 'lodash';
import { NumberAsString, SwapSide } from 'paraswap-core';
import { Interface, AbiCoder } from '@ethersproject/abi';
import { SolidlyStablePool } from './solidly-stable-pool';
import { Uniswapv2ConstantProductPool } from '../uniswap-v2/uniswap-v2-constant-product-pool';
import { PoolState, SolidlyPair, SolidlyPoolOrderedParams } from './types';
import { SolidlyConfig, Adapters } from './config';

const erc20Iface = new Interface(erc20ABI);
const solidlyPairIface = new Interface(solidlyPair);
const defaultAbiCoder = new AbiCoder();

export class Solidly extends UniswapV2 {
  pairs: { [key: string]: SolidlyPair } = {};
  stableFee?: number;
  volatileFee?: number;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(
      _.omit(SolidlyConfig, ['Velodrome', 'SpiritSwapV2', 'Cone']),
    );

  constructor(
    protected dexHelper: IDexHelper,
    protected dexKey: string,
    isDynamicFees = false,
    factoryAddress?: Address,
    subgraphURL?: string,
    initCode?: string,
    feeCode?: number,
    poolGasCost?: number,
    routerAddress?: Address,
  ) {
    super(
      dexHelper,
      dexKey,
      isDynamicFees,
      factoryAddress !== undefined
        ? factoryAddress
        : SolidlyConfig[dexKey][dexHelper.network].factoryAddress,
      subgraphURL === ''
        ? undefined
        : subgraphURL !== undefined
        ? subgraphURL
        : SolidlyConfig[dexKey][dexHelper.network].subgraphURL,
      initCode !== undefined
        ? initCode
        : SolidlyConfig[dexKey][dexHelper.network].initCode,
      feeCode !== undefined
        ? feeCode
        : SolidlyConfig[dexKey][dexHelper.network].feeCode,
      poolGasCost !== undefined
        ? poolGasCost
        : SolidlyConfig[dexKey][dexHelper.network].poolGasCost,
      solidlyPairIface,
      Adapters[dexHelper.network] || undefined,
    );

    this.stableFee = SolidlyConfig[dexKey][dexHelper.network].stableFee;
    this.volatileFee = SolidlyConfig[dexKey][dexHelper.network].volatileFee;

    this.factory = new dexHelper.web3Provider.eth.Contract(
      solidlyFactoryABI as any,
      factoryAddress !== undefined
        ? factoryAddress
        : SolidlyConfig[dexKey][dexHelper.network].factoryAddress,
    );

    this.router =
      routerAddress !== undefined
        ? routerAddress
        : SolidlyConfig[dexKey][dexHelper.network].router || '';
  }

  syncFindPairSolidly(
    from: Token,
    to: Token,
    stable: boolean,
  ): SolidlyPair | null {
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const typePostfix = this.poolPostfix(stable);
    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}-${typePostfix}`;
    let pair = this.pairs[key];
    if (pair) {
      return pair;
    }

    return null;
  }

  syncFindPairs(from: Token, to: Token): SolidlyPair[] {
    const pairs: SolidlyPair[] = [];
    if (from.address.toLowerCase() === to.address.toLowerCase()) return pairs;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    [false, true].map(stable => {
      const typePostfix = this.poolPostfix(stable);
      const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}-${typePostfix}`;
      let pair = this.pairs[key];
      if (pair) {
        pairs.push(pair);
      }
    });

    return pairs;
  }

  async findSolidlyPairsOnChains(
    from: Token,
    to: Token,
  ): Promise<SolidlyPair[]> {
    const pairs = this.syncFindPairs(from, to);
    if (pairs.length !== 0) {
      return pairs;
    }

    const [token0, token1] =
      from.address < to.address ? [from, to] : [to, from];

    const _pairs = await Promise.all(
      [false, true].map(async stable => {
        let exchange = await this.factory.methods
          // Solidly has additional boolean parameter "StablePool"
          // At first we look for uniswap-like volatile pool
          .getPair(token0.address, token1.address, stable)
          .call();

        let pair: SolidlyPair | undefined = undefined;
        if (exchange === NULL_ADDRESS) {
          pair = { token0, token1, stable };
        } else {
          pair = { token0, token1, exchange, stable };
        }

        const typePostfix = this.poolPostfix(stable);
        const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}-${typePostfix}`;
        this.pairs[key] = pair;

        return pair;
      }),
    );
    return _pairs;
  }

  async batchCatchUpPairsSolidly(
    from: Token,
    to: Token,
    blockNumber: number,
  ): Promise<SolidlyPair[]> {
    if (!blockNumber) return [];

    const pairs = await this.findSolidlyPairsOnChains(from, to);

    if (pairs.length === 0) {
      return [];
    }

    const pairsToFetch = pairs.filter(p => p.exchange !== undefined);

    const reserves = await this.getManyPoolReserves(pairsToFetch, blockNumber);

    if (reserves.length !== pairsToFetch.length) {
      this.logger.error(
        `Error_getManyPoolReserves didn't get any pool reserves`,
      );
    }

    const _pairs = await Promise.all(
      reserves.map(async (pairState, index) => {
        if (!pairState) {
          return null;
        }

        const _pair = pairsToFetch[index];
        if (!_pair.pool) {
          await this.addPool(
            '_' + (_pair.stable ? 'stable' : 'notstable'),
            _pair,
            pairState.reserves0,
            pairState.reserves1,
            pairState.feeCode,
            blockNumber,
          );
        } else {
          _pair.pool.setState(pairState, blockNumber);
        }
        return _pair;
      }),
    );

    _pairs.filter;
    return _pairs.filter(pair => pair !== null) as SolidlyPair[];
  }

  async addMasterPool(poolKey: string) {
    const _pairs = await this.dexHelper.cache.hget(this.dexmapKey, poolKey);
    if (!_pairs) {
      this.logger.warn(
        `did not find poolconfig in for key ${this.dexmapKey} ${poolKey}`,
      );
      return;
    }

    this.logger.info(
      `starting to listen to new pool: ${this.dexmapKey} ${poolKey}`,
    );
    const pair: [Token, Token] = JSON.parse(_pairs);
    this.batchCatchUpPairsSolidly(
      pair[0],
      pair[1],
      this.dexHelper.blockManager.getLatestBlockNumber(),
    );
  }

  async getManyPoolReserves(
    pairs: SolidlyPair[],
    blockNumber: number,
  ): Promise<PoolState[]> {
    try {
      const multiCallFeeData = pairs.map(pair =>
        this.getFeesMultiCallData(pair),
      );
      const calldata = pairs
        .map((pair, i) => {
          let calldata = [
            {
              target: pair.token0.address,
              callData: erc20Iface.encodeFunctionData('balanceOf', [
                pair.exchange!,
              ]),
            },
            {
              target: pair.token1.address,
              callData: erc20Iface.encodeFunctionData('balanceOf', [
                pair.exchange!,
              ]),
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

      const returnData = _.chunk(data.returnData, this.isDynamicFees ? 3 : 2);

      return pairs.map((pair, i) => ({
        reserves0: defaultAbiCoder
          .decode(['uint256'], returnData[i][0])[0]
          .toString(),
        reserves1: defaultAbiCoder
          .decode(['uint256'], returnData[i][1])[0]
          .toString(),
        feeCode: this.isDynamicFees
          ? multiCallFeeData[i]!.callDecoder(returnData[i][2])
          : (pair.stable ? this.stableFee : this.volatileFee) || this.feeCode,
      }));
    } catch (e) {
      this.logger.error(
        `Error_getManyPoolReserves could not get reserves with error:`,
        e,
      );
      return [];
    }
  }

  getSellPrice(
    priceParams: SolidlyPoolOrderedParams,
    srcAmount: bigint,
  ): bigint {
    return priceParams.stable
      ? SolidlyStablePool.getSellPrice(priceParams, srcAmount, this.feeFactor)
      : Uniswapv2ConstantProductPool.getSellPrice(
          priceParams,
          srcAmount,
          this.feeFactor,
        );
  }

  getBuyPrice(
    priceParams: SolidlyPoolOrderedParams,
    srcAmount: bigint,
  ): bigint {
    if (priceParams.stable) throw new Error(`Buy not supported`);
    return Uniswapv2ConstantProductPool.getBuyPrice(
      priceParams,
      srcAmount,
      this.feeFactor,
    );
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
      if (side === SwapSide.BUY) return null; // Buy side not implemented yet

      const from = this.dexHelper.config.wrapETH(_from);
      const to = this.dexHelper.config.wrapETH(_to);
      from.address = from.address.toLowerCase();
      to.address = to.address.toLowerCase();

      if (from.address === to.address) {
        return null;
      }

      const tokenAddress = [from.address, to.address]
        .sort((a, b) => (a > b ? 1 : -1))
        .join('_');

      let pairs = this.syncFindPairs(from, to);
      if (!pairs.length) {
        pairs = await this.batchCatchUpPairsSolidly(from, to, blockNumber);
        pairs = this.syncFindPairs(from, to);
      }

      const results = pairs.map(pair => {
        const poolIdentifier =
          `${this.dexKey}_${tokenAddress}` + this.poolPostfix(pair.stable);

        if (limitPools && limitPools.every(p => p !== poolIdentifier))
          return null;

        const pairParam = this.getSolidlyPairOrderedParams(
          from,
          to,
          blockNumber,
          pair.stable,
        );

        if (!pairParam) return null;

        const unitAmount = getBigIntPow(
          // @ts-expect-error Buy side is not implemented yet
          side === SwapSide.BUY ? to.decimals : from.decimals,
        );
        const unit =
          // @ts-expect-error Buy side is not implemented yet
          side === SwapSide.BUY
            ? this.getBuyPricePath(unitAmount, [pairParam])
            : this.getSellPricePath(unitAmount, [pairParam]);

        const prices =
          // @ts-expect-error Buy side is not implemented yet
          side === SwapSide.BUY
            ? amounts.map(amount =>
                amount === 0n ? 0n : this.getBuyPricePath(amount, [pairParam]),
              )
            : amounts.map(amount =>
                amount === 0n ? 0n : this.getSellPricePath(amount, [pairParam]),
              );

        return {
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
        };
      });

      const resultPools = results as ExchangePrices<UniswapV2Data>;
      const resultPoolsFiltered = resultPools.filter(item => !!item); // filter null elements
      return resultPoolsFiltered.length > 0 ? resultPoolsFiltered : null;
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.subgraphURL) return [];

    const stableFieldKey =
      this.dexKey.toLowerCase() === 'solidly' ? 'stable' : 'isStable';

    const query = `query ($token: Bytes!, $count: Int) {
      pools0: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token0: $token, reserve0_gt: 1, reserve1_gt: 1}) {
        id
        ${stableFieldKey}
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
        ${stableFieldKey}
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
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools0 && data.pools1))
      throw new Error("Couldn't fetch the pools from the subgraph");
    const pools0 = _.map(data.pools0, pool => ({
      exchange: this.dexKey,
      stable: pool[stableFieldKey],
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
      stable: pool[stableFieldKey],
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

  // Same as at uniswap-v2-pool.json, but extended with decimals and stable
  getSolidlyPairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
    stable: boolean,
  ): SolidlyPoolOrderedParams | null {
    const pair = this.syncFindPairSolidly(from, to, stable);
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

    const pairReversed =
      pair.token1.address.toLowerCase() === from.address.toLowerCase();
    if (pairReversed) {
      return {
        tokenIn: from.address,
        tokenOut: to.address,
        reservesIn: pairState.reserves1,
        reservesOut: pairState.reserves0,
        fee: pairState.feeCode.toString(),
        direction: false,
        exchange: pair.exchange,
        decimalsIn: from.decimals,
        decimalsOut: to.decimals,
        stable,
      };
    }
    return {
      tokenIn: from.address,
      tokenOut: to.address,
      reservesIn: pairState.reserves0,
      reservesOut: pairState.reserves1,
      fee: pairState.feeCode.toString(),
      direction: true,
      exchange: pair.exchange,
      decimalsIn: from.decimals,
      decimalsOut: to.decimals,
      stable,
    };
  }

  async getPoolIdentifiers(
    _from: Token,
    _to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) return [];

    const from = this.dexHelper.config.wrapETH(_from);
    const to = this.dexHelper.config.wrapETH(_to);

    if (from.address.toLowerCase() === to.address.toLowerCase()) {
      return [];
    }

    const tokenAddress = [from.address.toLowerCase(), to.address.toLowerCase()]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
    const poolIdentifierUniswap = poolIdentifier + this.poolPostfix(false);
    const poolIdentifierStable = poolIdentifier + this.poolPostfix(true);
    return [poolIdentifierUniswap, poolIdentifierStable];
  }

  poolPostfix(stable: boolean) {
    return stable ? 'S' : 'U';
  }

  async getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);
    return super.getSimpleParam(src, dest, srcAmount, destAmount, data, side);
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: UniswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);
    return super.getAdapterParam(
      srcToken,
      destToken,
      srcAmount,
      toAmount,
      data,
      side,
    );
  }
}
