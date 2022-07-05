import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import _, { result, zipObjectDeep } from 'lodash';
import {
  Token,
  Address,
  ExchangePrices,
  Log,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { wrapETH, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  HodltreeFlashloanExchangeData,
  PoolState,
  PoolStateMap,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { HodltreeFlashloanExchangeConfig, Adapters } from './config';

import PoolABI from '../../abi/hodltree-flashloan-exchange/LiquidityPool.json';
import ExchangeABI from '../../abi/hodltree-flashloan-exchange/Exchange.json';

function typecastReadOnlyPoolState(pool: DeepReadonly<PoolState>): PoolState {
  return _.cloneDeep(pool) as PoolState;
}

export class HodltreeFlashloanExchangeEventPool extends StatefulEventSubscriber<PoolStateMap> {
  public exchangeInterface: Interface;
  public poolInterface: Interface;

  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  poolDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  pools: PoolState[] = [];

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected exchangeAddress: Address,
    protected poolAddresses: Address[],
  ) {
    super(parentName, logger);

    this.poolInterface = new Interface(PoolABI);
    this.exchangeInterface = new Interface(ExchangeABI);
    this.poolDecoder = (log: Log) => this.poolInterface.parseLog(log);
    this.addressesSubscribed = [...poolAddresses];

    // Add handlerss
    this.handlers['SetFees'] = this.handleSetFees.bind(this);
    this.handlers['Deposit'] = this.handleDeposit.bind(this);
    this.handlers['Withdraw'] = this.handleWithdraw.bind(this);
    this.handlers['Borrow'] = this.handleBorrow.bind(this);
  }

  /**
   * The function is called everytime any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const _state: PoolStateMap = {};
    for (const [address, pool] of Object.entries(state))
      _state[address] = typecastReadOnlyPoolState(pool);

    try {
      const event = this.poolDecoder(log);
      if (event.name in this.handlers) {
        _state[log.address] = this.handlers[event.name](
          event,
          _state[log.address],
          log,
        );
      }
      return _state;
    } catch (e) {
      this.logger.error(
        `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
        e,
      );
      return null;
    }
  }

  handleSetFees(event: any, pool: PoolState, log: Log): PoolState {
    pool.borrowFee = BigInt(event.args.borrowFee.toString());
    return pool;
  }

  handleDeposit(event: any, pool: PoolState, log: Log): PoolState {
    for (let tokenId = 0; tokenId < pool.tokenInfo.length; tokenId++) {
      if (!pool.tokenInfo[tokenId].tokenBalance)
        pool.tokenInfo[tokenId].tokenBalance = BigInt(0);
      pool.tokenInfo[tokenId].tokenBalance += BigInt(
        event.args.tokenAmounts[tokenId],
      );
    }
    return pool;
  }

  handleWithdraw(event: any, pool: PoolState, log: Log): PoolState {
    for (let tokenId = 0; tokenId < pool.tokenInfo.length; tokenId++) {
      pool.tokenInfo[tokenId].tokenBalance -= BigInt(
        event.args.tokenAmounts[tokenId],
      );
    }
    return pool;
  }

  handleBorrow(event: any, pool: PoolState, log: Log): PoolState {
    for (let tokenId = 0; tokenId < pool.tokenInfo.length; tokenId++) {
      pool.tokenInfo[tokenId].tokenBalance = BigInt(
        event.args.balances[tokenId],
      );
    }
    return pool;
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenrate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subsriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<Readonly<PoolStateMap>> {
    const requests = 4;
    const bfOffset = 0;
    const precOffset = 1;
    const ntOffset = 2;
    const bOffset = 3;
    let calldata = [];
    for (let pool of this.addressesSubscribed) {
      calldata.push({
        target: pool,
        callData: this.poolInterface.encodeFunctionData('borrowFee', []),
      });
      calldata.push({
        target: pool,
        callData: this.poolInterface.encodeFunctionData('PCT_PRECISION', []),
      });
      calldata.push({
        target: pool,
        callData: this.poolInterface.encodeFunctionData('N_TOKENS', []),
      });
      calldata.push({
        target: pool,
        callData: this.poolInterface.encodeFunctionData('balances', []),
      });
    }

    let rawResultData: any[] = (
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber)
    ).returnData;
    let resultData = [];
    for (let poolId = 0; poolId < this.addressesSubscribed.length; poolId++) {
      resultData.push(
        BigInt(
          this.poolInterface
            .decodeFunctionResult(
              'borrowFee',
              rawResultData[poolId * requests + bfOffset],
            )
            .toString(),
        ),
      );
      resultData.push(
        BigInt(
          this.poolInterface
            .decodeFunctionResult(
              'PCT_PRECISION',
              rawResultData[poolId * requests + precOffset],
            )
            .toString(),
        ),
      );
      resultData.push(
        BigInt(
          this.poolInterface
            .decodeFunctionResult(
              'N_TOKENS',
              rawResultData[poolId * requests + ntOffset],
            )
            .toString(),
        ),
      );
      resultData.push(
        this.poolInterface.decodeFunctionResult(
          'balances',
          rawResultData[poolId * requests + bOffset],
        )[0],
      );
    }

    calldata = [];
    for (let poolId = 0; poolId < this.addressesSubscribed.length; poolId++) {
      const nTokens: number = Number(resultData[poolId * requests + ntOffset]);
      for (let tokenId = 0; tokenId < nTokens; tokenId++) {
        calldata.push({
          target: this.addressesSubscribed[poolId],
          callData: this.poolInterface.encodeFunctionData('TOKENS', [tokenId]),
        });
      }
    }
    let resultTokens = (
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber)
    ).returnData;
    resultTokens = resultTokens.map((val: any) =>
      this.poolInterface.decodeFunctionResult('TOKENS', val)[0].toLowerCase(),
    );

    calldata = [];
    for (let poolId = 0; poolId < this.addressesSubscribed.length; poolId++) {
      const nTokens: number = Number(resultData[poolId * requests + ntOffset]);
      for (let tokenId = 0; tokenId < nTokens; tokenId++) {
        calldata.push({
          target: this.addressesSubscribed[poolId],
          callData: this.poolInterface.encodeFunctionData('TOKENS_MUL', [
            tokenId,
          ]),
        });
      }
    }
    let resultMuls = (
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber)
    ).returnData;
    resultMuls = resultMuls.map((val: any) =>
      BigInt(
        this.poolInterface
          .decodeFunctionResult('TOKENS_MUL', val)[0]
          .toString(),
      ),
    );

    const onChainState: PoolStateMap = {};
    let tmpPools = [];

    for (let poolId = 0; poolId < this.addressesSubscribed.length; poolId++) {
      const tokens: string[] = resultTokens.splice(
        0,
        Number(resultData[poolId * requests + ntOffset]),
      ) as string[];
      const balances: bigint[] = resultData[
        poolId * requests + bOffset
      ] as bigint[];
      const tokenMuls: bigint[] = resultMuls.splice(
        0,
        Number(resultData[poolId * requests + ntOffset]),
      ) as bigint[];

      const pool: PoolState = {
        poolAddress: this.addressesSubscribed[poolId],
        borrowFee: BigInt(resultData[poolId * requests + bfOffset] as string),
        PCT_PRECISION: BigInt(
          resultData[poolId * requests + precOffset] as string,
        ),
        tokenInfo: [],
        tokensToId: {},
        TOKENS_MUL: [],
      };

      for (let tokenId: number = 0; tokenId < tokens.length; tokenId++) {
        pool.tokenInfo.push({
          address: tokens[tokenId],
          tokenBalance: balances[tokenId],
        });
        pool.tokensToId[tokens[tokenId]] = tokenId as number;
        pool.TOKENS_MUL[tokenId] = tokenMuls[tokenId];
      }
      onChainState[this.addressesSubscribed[poolId]] = pool;
      tmpPools.push(pool);
    }
    this.pools = tmpPools;

    return onChainState;
  }
}

export class HodltreeFlashloanExchange
  extends SimpleExchange
  implements IDex<HodltreeFlashloanExchangeData, null>
{
  protected eventPools: HodltreeFlashloanExchangeEventPool;

  readonly hasConstantPriceLargeAmounts = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(HodltreeFlashloanExchangeConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected exchangeAddress: Address = HodltreeFlashloanExchangeConfig[
      dexKey
    ][network].exchange,
    protected poolAddresses: Address[] = HodltreeFlashloanExchangeConfig[
      dexKey
    ][network].pools,
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new HodltreeFlashloanExchangeEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
      exchangeAddress,
      poolAddresses,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.eventPools.generateState(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const pools = this.getPools(srcToken, destToken);
    return pools.map(({ poolAddress }) => `${this.dexKey}_${poolAddress}`);
  }

  getPools(from: Token, to: Token): PoolState[] {
    return this.eventPools.pools.filter(val => {
      const tokenFrom: string = from.address.toLowerCase();
      const tokenTo: string = to.address.toLowerCase();
      return (
        val.tokensToId[tokenFrom as keyof Object] !== undefined &&
        val.tokensToId[tokenTo as keyof Object] !== undefined
      );
    });
  }

  async setupEventPools(blockNumber: number) {
    const poolState = await this.eventPools.generateState(blockNumber);
    this.eventPools.setState(poolState, blockNumber);
    this.dexHelper.blockManager.subscribeToLogs(
      this.eventPools,
      this.eventPools.addressesSubscribed,
      blockNumber,
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
  ): Promise<null | ExchangePrices<HodltreeFlashloanExchangeData>> {
    const poolsForTokens = this.getPools(srcToken, destToken);
    const allowedPools = limitPools
      ? poolsForTokens.filter(({ poolAddress }) =>
          limitPools.includes(`${this.dexKey}_${poolAddress}`),
        )
      : poolsForTokens;
    if (!allowedPools.length) return null;
    const tokenIn: string = srcToken.address.toLowerCase();
    const tokenOut: string = destToken.address.toLowerCase();
    let poolPrices = [];
    if (side === SwapSide.BUY) {
      poolPrices = poolsForTokens.map((pool: PoolState) => {
        const prices = amounts.map((value: bigint) => {
          return this.getTokenPrice(
            pool.tokensToId[tokenIn as keyof {}],
            pool.tokensToId[tokenOut as keyof {}],
            value,
            pool,
            side,
          );
        });
        return {
          prices,
          unit: this.getTokenPrice(
            pool.tokensToId[tokenIn as keyof {}],
            pool.tokensToId[tokenOut as keyof {}],
            BigInt(1),
            pool,
            side,
          ),
          data: {
            poolAddress: pool.poolAddress,
          },
          poolIdentifier: `${this.dexKey}_${pool.poolAddress}`,
          exchange: this.dexKey,
          gasCost: 200 * 1000,
        };
      });
    } else {
      poolPrices = poolsForTokens.map((pool: PoolState) => {
        const prices = amounts.map((value: bigint) => {
          return this.getTokenPrice(
            pool.tokensToId[tokenIn as keyof {}],
            pool.tokensToId[tokenOut as keyof {}],
            value,
            pool,
            side,
          );
        });
        return {
          prices,
          unit: this.getTokenPrice(
            pool.tokensToId[tokenIn as keyof {}],
            pool.tokensToId[tokenOut as keyof {}],
            BigInt(1),
            pool,
            side,
          ),
          data: {
            poolAddress: pool.poolAddress,
          },
          poolIdentifier: `${this.dexKey}_${pool.poolAddress}`,
          exchange: this.dexKey,
          gasCost: 200 * 1000,
        };
      });
    }
    return poolPrices as ExchangePrices<HodltreeFlashloanExchangeData>;
  }

  getTokenPrice(
    srcTokenId: number,
    destTokenId: number,
    amountIn: bigint,
    pool: PoolState,
    side: SwapSide,
  ): bigint | null {
    let price: bigint = BigInt(0);
    amountIn = BigInt(amountIn);
    if (side == SwapSide.SELL) {
      price = this.toTokenDecimals(
        (amountIn * pool.TOKENS_MUL[srcTokenId] * pool.PCT_PRECISION) /
          (pool.borrowFee + pool.PCT_PRECISION),
        pool.TOKENS_MUL[destTokenId],
      );
      return pool.tokenInfo[destTokenId].tokenBalance >= price ? price : null;
    } else {
      price = this.toTokenDecimals(
        (amountIn *
          pool.TOKENS_MUL[destTokenId] *
          (pool.borrowFee + pool.PCT_PRECISION)) /
          pool.PCT_PRECISION,
        pool.TOKENS_MUL[srcTokenId],
      );
      return pool.tokenInfo[destTokenId].tokenBalance >= amountIn
        ? price
        : null;
    }
  }

  toTokenDecimals(amount: bigint, tokenMultiplier: bigint): bigint {
    let tokenDecimals: number = 18 - Math.log10(Number(tokenMultiplier));
    return amount / BigInt(Math.pow(10, 18 - tokenDecimals));
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() couls be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: HodltreeFlashloanExchangeData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          liquidityPool_: 'address',
          tokenIn_: 'address',
          tokenOut_: 'address',
          inAmount_: 'uint256',
        },
      },
      {
        liquidityPool_: data.poolAddress,
        tokenIn_: srcToken,
        tokenOut_: destToken,
        inAmount_: srcAmount,
      },
    );

    return {
      targetExchange: this.exchangeAddress,
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
    data: HodltreeFlashloanExchangeData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapData = this.eventPools.exchangeInterface.encodeFunctionData(
      'swap',
      [data.poolAddress, srcToken, destToken, srcAmount],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.exchangeAddress,
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const availablePools = this.eventPools.pools.filter(
      val =>
        val.tokensToId[tokenAddress.toLowerCase() as keyof {}] !== undefined,
    );

    const sortedPools = availablePools.sort(
      (p1, p2) =>
        Number(
          p2.tokenInfo[p2.tokensToId[tokenAddress as keyof {}] as keyof {}]
            .tokenBalance,
        ) -
        Number(
          p1.tokenInfo[p1.tokensToId[tokenAddress as keyof {}] as keyof {}]
            .tokenBalance,
        ),
    );

    return sortedPools.splice(0, limit).map(val => {
      return {
        exchange: this.dexKey,
        address: val.poolAddress,
        connectorTokens: this.getPoolTokens(val),
        liquidityUSD: this.calculateLiquidity(val),
      };
    });
  }

  getPoolTokens(pool: PoolState): Token[] {
    return pool.tokenInfo.map((val, index) => {
      return {
        address: val.address,
        decimals: 18 - Math.log10(Number(pool.TOKENS_MUL[index])),
      };
    });
  }

  calculateLiquidity(pool: PoolState): number {
    let sum = 0;
    for (let tokenId = 0; tokenId < pool.tokenInfo.length; tokenId++) {
      sum += Number(
        BigInt(pool.tokenInfo[tokenId].tokenBalance) /
          BigInt(pool.TOKENS_MUL[tokenId]),
      );
    }
    return sum;
  }
}
