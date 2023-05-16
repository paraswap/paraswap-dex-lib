import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  Log,
  Logger,
  MultiCallInput,
  MultiCallOutput,
  Token,
} from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { CollateralInfo, DecodedCollateralState, PoolState } from './types';
import BobVaultABI from '../../abi/bob-swap/BobVault.json';
import { Address } from '@paraswap/core';
import { decodeCollateralStateResult } from './utils';
import { MultiCallParams } from '../../lib/multi-wrapper';

export class BobSwapEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];
  bobSwapIface: Interface = new Interface(BobVaultABI);
  bobToken: Address;
  bobSwap: Address;
  tokens: Array<Token>;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,

    protected bobSwapAddress: Address,
    protected bobTokenAddress: Address,
    protected tokensAddresses: Array<Token>,
    readonly erc20Interface: Interface,
  ) {
    super(parentName, 'BobSwap', dexHelper, logger);

    this.logDecoder = (log: Log) => this.bobSwapIface.parseLog(log);
    this.addressesSubscribed = [bobSwapAddress];
    this.bobSwap = bobSwapAddress;
    this.bobToken = bobTokenAddress;
    this.tokens = tokensAddresses;

    // Add handlers
    this.handlers['AddCollateral'] = this.handleAddCollateralEvent.bind(this);
    this.handlers['UpdateFees'] = this.handleUpdateFeesEvent.bind(this);
    this.handlers['UpdateMaxBalance'] =
      this.handleUpdateMaxBalanceEvent.bind(this);
    this.handlers['Buy'] = this.handleBuyEvent.bind(this);
    this.handlers['Sell'] = this.handleSellEvent.bind(this);
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
    this.handlers['Give'] = this.handleGiveEvent.bind(this);
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  /**
   * The function checks if state is correct, because
   * after AddCollateral event we don't know the exact
   * decimals of added token. In that case we have to
   * fetch it on-chain, but it is very rare situation.
   * Also, we will support very small amount of tokens,
   * so we can generate state from scratch every time.
   */
  async fetchAndUpdateState(
    blockNumber?: number,
  ): Promise<DeepReadonly<PoolState>> {
    if (blockNumber === undefined) {
      blockNumber = await this.dexHelper.provider.getBlockNumber();
    }

    const state = await this.getState(blockNumber);
    if (state !== null) {
      return state;
    }

    const newState = await this.generateState(blockNumber);
    this.setState(newState, blockNumber);
    return newState;
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(
    blockNumber: number | 'latest',
  ): Promise<DeepReadonly<PoolState>> {
    let multicallInputs: MultiCallParams<DecodedCollateralState>[] =
      this.tokens.map(token => {
        return {
          target: this.bobSwapAddress.toString(),
          callData: this.bobSwapIface.encodeFunctionData('collateral', [
            token.address,
          ]),
          decodeFunction: decodeCollateralStateResult,
        };
      });

    const res =
      await this.dexHelper.multiWrapper.tryAggregate<DecodedCollateralState>(
        false,
        multicallInputs,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      );

    let i: number = 0;

    let collaterals: Record<Address, CollateralInfo> = {};

    for (let token of this.tokens) {
      let collateralInfo = res[i++].returnData as DecodedCollateralState;
      collaterals[token.address.toLowerCase()] = {
        inFee: collateralInfo.inFee.toBigInt(),
        outFee: collateralInfo.outFee.toBigInt(),
        price: collateralInfo.price.toBigInt(),
        balance: collateralInfo.balance.toBigInt(),
        maxBalance: BigInt(
          '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        ),
      };
    }

    return {
      collaterals: collaterals,
    };
  }

  handleAddCollateralEvent(
    event: any,
    state: PoolState,
    log: Log,
  ): PoolState | null {
    const token = event.args.token.toLowerCase();
    const price = bigIntify(event.args.price);

    state.collaterals[token].price = price;

    return state;
  }

  handleUpdateFeesEvent(event: any, state: PoolState, log: Log) {
    const token = event.args.token.toLowerCase();
    const inFee = bigIntify(event.args.inFee);
    const outFee = bigIntify(event.args.outFee);

    if (state.collaterals[token]) {
      state.collaterals[token].inFee = inFee;
      state.collaterals[token].outFee = outFee;
    } else {
      state.collaterals[token] = {
        inFee: inFee,
        outFee: outFee,
        price: 0n,
        balance: 0n,
        maxBalance: BigInt(
          '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        ),
      };
    }

    return state;
  }

  handleUpdateMaxBalanceEvent(event: any, state: PoolState, log: Log) {
    const token = event.args.token.toLowerCase();
    const maxBalance = bigIntify(event.args.maxBalance);

    state.collaterals[token].maxBalance = maxBalance;

    return state;
  }

  handleGiveEvent(event: any, state: PoolState, log: Log) {
    const token = event.args.token.toLowerCase();
    const amount = bigIntify(event.args.amount);

    state.collaterals[token].balance += amount;

    return state;
  }

  handleBuyEvent(event: any, state: PoolState, log: Log) {
    const token = event.args.token.toLowerCase();
    const amount = bigIntify(event.args.amountIn);

    state.collaterals[token].balance +=
      amount - (amount * state.collaterals[token].inFee) / 10n ** 18n;

    return state;
  }

  handleSellEvent(event: any, state: PoolState, log: Log) {
    const token = event.args.token.toLowerCase();
    const amount = bigIntify(event.args.amountIn);

    state.collaterals[token].balance -=
      (amount * state.collaterals[token].price) / 10n ** 18n;

    return state;
  }

  handleSwapEvent(event: any, state: PoolState, log: Log) {
    const inToken = event.args.inToken.toLowerCase();
    const outToken = event.args.outToken.toLowerCase();
    const amount = bigIntify(event.args.amountIn);

    const sellAmount =
      amount - (amount * state.collaterals[inToken].inFee) / 10n ** 18n;
    const bobAmount =
      (sellAmount * 10n ** 18n) / state.collaterals[inToken].price;
    const buyAmount =
      (bobAmount * state.collaterals[outToken].price) / 10n ** 18n;

    state.collaterals[inToken].balance += sellAmount;
    state.collaterals[outToken].balance -= buyAmount;

    return state;
  }
}
