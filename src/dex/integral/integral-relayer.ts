import { BigNumber, ethers } from 'ethers';
import { Interface } from '@ethersproject/abi';
import { BytesLike, LogDescription } from 'ethers/lib/utils';
import { IDexHelper } from '../../dex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, BlockHeader, Log, Logger } from '../../types';
import {
  PoolInitProps,
  RelayerPoolState,
  RelayerState,
  RelayerTokensState,
} from './types';
import IntegralRelayerABI from '../../abi/integral/relayer.json';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { uint256ToBigInt } from '../../lib/decoders';
import { uint32ToNumber } from './utils';

export type OnPoolEnabledSetCallback = (
  poolAddress: Address,
  poolState: RelayerPoolState,
  blockNumber: number,
) => Promise<void>;

export class IntegralRelayer extends StatefulEventSubscriber<RelayerState> {
  handlers: {
    [event: string]: (
      event: any,
      state: RelayerState,
      blockHeader: Readonly<BlockHeader>,
    ) => AsyncOrSync<RelayerState>;
  } = {};

  logDecoder: (log: Log) => any;

  private pools: {
    [poolAddress: Address]: { token0: Address; token1: Address };
  } = {};
  private orders: {
    [id: string]: { enqueuedAt: number; executedAt: number };
  } = {};
  public readonly relayerIface = new Interface(IntegralRelayerABI);

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    readonly erc20Interface: Interface,
    readonly relayerAddress: Address,
    initPools: PoolInitProps,
    protected readonly onPoolEnabledSet: OnPoolEnabledSetCallback,
    logger: Logger,
    mapKey: string = '',
  ) {
    super(parentName, `${parentName} Relayer`, dexHelper, logger, true, mapKey);
    this.addPools(initPools);
    this.addressesSubscribed = [relayerAddress];
    this.logDecoder = (log: Log) => this.relayerIface.parseLog(log);
    this.handlers['SwapFeeSet'] = this.handleSwapFeeSet.bind(this);
    this.handlers['PairEnabledSet'] = this.handlePairEnabledSet.bind(this);
    this.handlers['WrapEth'] = this.handleWrapEth.bind(this);
    this.handlers['UnwrapWeth'] = this.handleUnwrapWeth.bind(this);
    this.handlers['Upgraded'] = this.handleUpgraded.bind(this);
  }

  addPools(more: PoolInitProps) {
    Object.keys(more).forEach(_poolAddress => {
      const poolAddress = _poolAddress.toLowerCase();
      if (!this.pools[poolAddress]) {
        this.pools[poolAddress] = {
          token0: more[_poolAddress].token0.toLowerCase(),
          token1: more[_poolAddress].token1.toLowerCase(),
        };
      }
    });
  }

  getPools() {
    return this.pools;
  }

  executeOrder(id: bigint, blockNumber: number) {
    this.orders[id.toString()].executedAt = blockNumber;
    delete this.orders[id.toString()];
  }

  async generateState(blockNumber?: number | 'latest'): Promise<RelayerState> {
    const relayer = new this.dexHelper.web3Provider.eth.Contract(
      IntegralRelayerABI as any,
      this.relayerAddress,
    );
    const pools = Object.keys(this.pools);
    const tokenBalances = this.initTokens();
    const tokens = Object.keys(tokenBalances);
    const relayerCallDatas: MultiCallParams<boolean | bigint | number>[] = pools
      .map(poolAddress => [
        {
          target: this.relayerAddress,
          callData: relayer.methods.isPairEnabled(poolAddress).encodeABI(),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.relayerAddress,
          callData: relayer.methods.swapFee(poolAddress).encodeABI(),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.relayerAddress,
          callData: relayer.methods.getTwapInterval(poolAddress).encodeABI(),
          decodeFunction: uint32ToNumber,
        },
      ])
      .flat();

    const relayerAndTokenCallDatas = relayerCallDatas.concat(
      tokens
        .map(token => [
          {
            target: token,
            callData: this.erc20Interface.encodeFunctionData('balanceOf', [
              this.relayerAddress,
            ]),
            decodeFunction: uint256ToBigInt,
          },
          {
            target: this.relayerAddress,
            callData: relayer.methods.getTokenLimitMin(token).encodeABI(),
            decodeFunction: uint256ToBigInt,
          },
          {
            target: this.relayerAddress,
            callData: relayer.methods
              .getTokenLimitMaxMultiplier(token)
              .encodeABI(),
            decodeFunction: uint256ToBigInt,
          },
        ])
        .flat(),
    );

    const relayerInfos = await this.dexHelper.multiWrapper.aggregate<
      boolean | bigint | number
    >(relayerAndTokenCallDatas, blockNumber);

    const [relayerItemCount, tokenItemCount] = [3, 3];
    const state: RelayerState = { pools: {}, tokens: tokenBalances };
    const offset = pools.length * relayerItemCount;
    const tokenLimits: {
      [tokenAddress: Address]: { min: bigint; maxMultiplier: bigint };
    } = {};
    tokens.forEach((token, i) => {
      const [balance, min, maxMultiplier] = [
        BigInt(relayerInfos[i * tokenItemCount + offset]),
        BigInt(relayerInfos[i * tokenItemCount + offset + 1]),
        BigInt(relayerInfos[i * tokenItemCount + offset + 2]),
      ];
      tokenLimits[token] = { min, maxMultiplier };
      state.tokens[token] = { balance };
    });

    pools.forEach((poolAddress, i) => {
      const [isEnabled, swapFee, twapInterval] = [
        Boolean(relayerInfos[i * relayerItemCount]),
        BigInt(relayerInfos[i * relayerItemCount + 1]),
        Number(relayerInfos[i * relayerItemCount + 2]),
      ];

      const min0 = tokenLimits[this.pools[poolAddress].token0].min;
      const min1 = tokenLimits[this.pools[poolAddress].token1].min;
      const maxMultiplier0 =
        tokenLimits[this.pools[poolAddress].token0].maxMultiplier;
      const maxMultiplier1 =
        tokenLimits[this.pools[poolAddress].token1].maxMultiplier;

      state.pools[poolAddress] = {
        isEnabled,
        swapFee,
        twapInterval,
        limits: { min0, min1, maxMultiplier0, maxMultiplier1 },
      };
    });

    return state;
  }

  protected async processLog(
    state: DeepReadonly<RelayerState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<RelayerState> {
    const event = this.logDecoder(log);
    if (event.name in this.handlers) {
      await this.handlers[event.name](event, state, blockHeader);
    }

    return state;
  }

  handleSwapFeeSet(
    event: LogDescription,
    state: RelayerState,
    _blockHeader: Readonly<BlockHeader>,
  ) {
    const poolAddress = event.args.pair.toLowerCase();
    state.pools[poolAddress].swapFee = BigInt(event.args.fee);
    return state;
  }

  async handlePairEnabledSet(
    event: LogDescription,
    state: RelayerState,
    blockHeader: Readonly<BlockHeader>,
  ) {
    const poolAddress = event.args.pair.toLowerCase();
    state.pools[poolAddress].isEnabled = Boolean(event.args.enabled);
    await this.onPoolEnabledSet(
      poolAddress,
      state.pools[poolAddress],
      blockHeader.number,
    );
    return state;
  }

  async handleWrapEth(
    event: LogDescription,
    state: RelayerState,
    _blockHeader: Readonly<BlockHeader>,
  ) {
    const tokenAddress =
      this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase();
    const amountIn = BigNumber.from(event.args.amount).toBigInt();

    if (state.tokens[tokenAddress]) {
      state.tokens[tokenAddress].balance += amountIn;
    } else {
      state.tokens[tokenAddress] = { balance: amountIn };
    }
    return state;
  }

  async handleUnwrapWeth(
    event: LogDescription,
    state: RelayerState,
    blockHeader: Readonly<BlockHeader>,
  ) {
    const tokenAddress =
      this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase();
    const amountOut = BigNumber.from(event.args.amount).toBigInt();
    // state balance is out of sync
    if (
      !state.tokens[tokenAddress] ||
      state.tokens[tokenAddress].balance < amountOut
    ) {
      return await this.generateState(blockHeader.number);
    }
    state.tokens[tokenAddress].balance -= amountOut;
    return state;
  }

  async handleUpgraded(
    _event: LogDescription,
    state: RelayerState,
    blockHeader: Readonly<BlockHeader>,
  ) {
    try {
      return await this.generateState(blockHeader.number);
    } catch (e) {
      this.logger.error(
        `Integral Relayer: Contract upgraded, please upgrade event pool`,
        e,
      );
      return state;
    }
  }

  private initTokens() {
    return Object.entries(this.pools).reduce<RelayerTokensState>(
      (memo, [, { token0, token1 }]) => {
        memo[token0] = (!!memo[token0] && memo[token0]) || { balance: 0n };
        memo[token1] = (!!memo[token1] && memo[token1]) || { balance: 0n };
        return memo;
      },
      {},
    );
  }
}
