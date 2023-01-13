import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  Address,
  Log,
  Logger,
  MultiCallInput,
  MultiCallOutput,
} from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, WombatPoolConfigInfo } from './types';
import PoolABI from '../../abi/wombat/pool.json';
import AssetABI from '../../abi/wombat/asset.json';

export class WombatEventPool extends StatefulEventSubscriber<PoolState> {
  static readonly poolInterface = new Interface(PoolABI);
  static readonly assetInterface = new Interface(AssetABI);

  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  blankState: PoolState = {
    asset: {},
    underlyingAddresses: [],
    params: {
      ampFactor: 0n,
      haircutRate: 0n,
    },
  };
  constructor(
    dexKey: string,
    name: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected poolAddress: Address,
    protected poolCfg: WombatPoolConfigInfo,
  ) {
    super(
      `${dexKey} ${name}`,
      `${dexKey}-${network} ${name}`,
      dexHelper,
      logger,
    );

    this.logDecoder = (log: Log) => WombatEventPool.poolInterface.parseLog(log);

    // users-actions handlers
    this.handlers['Deposit'] = this.handleDeposit.bind(this);
    this.handlers['Withdraw'] = this.handleWithdraw.bind(this);
    this.handlers['Swap'] = this.handleSwap.bind(this);

    // admin-actions handlers
    /** @todo handle dynamically updating params */
    // this.handlers['SetAmpFactor'] = this.handleDeposit.bind(this);
    // this.handlers['SetHaircutRate'] = this.handleDeposit.bind(this);

    /** @todo handle dynamically adding/removing assets */
    // this.handlers['AssetAdded'] = this.handleAssetAdded.bind(this);
    // this.handlers['AssetRemoved'] = this.handleAssetRemoved.bind(this);
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
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    // const multiCallInputs = this.getGenerateStateMultiCallInputs();

    // 1. Generate multiCallInputs
    const multiCallInputs: MultiCallInput[] = [];
    // 1 A. pool params
    // ampFactor
    multiCallInputs.push({
      target: this.poolAddress,
      callData: WombatEventPool.poolInterface.encodeFunctionData('ampFactor'),
    });
    // haircutRate
    multiCallInputs.push({
      target: this.poolAddress,
      callData: WombatEventPool.poolInterface.encodeFunctionData('haircutRate'),
    });

    // 1 B. asset state: cash and liability
    for (const tokenInfo of Object.values(this.poolCfg.tokens)) {
      multiCallInputs.push({
        target: tokenInfo.assetAddress,
        callData: WombatEventPool.assetInterface.encodeFunctionData('cash'),
      });
      multiCallInputs.push({
        target: tokenInfo.assetAddress,
        callData:
          WombatEventPool.assetInterface.encodeFunctionData('liability'),
      });
    }

    // 2. Decode MultiCallOutput
    let returnData: MultiCallOutput[] = [];
    if (multiCallInputs.length) {
      returnData = (
        await this.dexHelper.multiContract.methods
          .aggregate(multiCallInputs)
          .call({}, blockNumber)
      ).returnData;
    }

    let i = 0;
    // 2 A. decode pool params
    const ampFactor = WombatEventPool.poolInterface.decodeFunctionResult(
      'ampFactor',
      returnData[i++],
    )[0];
    const haircutRate = WombatEventPool.poolInterface.decodeFunctionResult(
      'haircutRate',
      returnData[i++],
    )[0];
    const poolState: PoolState = {
      params: {
        ampFactor,
        haircutRate,
      },
      underlyingAddresses: [],
      asset: {},
    };
    // 2 B. decode asset state: cash and liability
    for (const [tokenAddress, tokenInfo] of Object.entries(
      this.poolCfg.tokens,
    )) {
      const cash = WombatEventPool.assetInterface.decodeFunctionResult(
        'cash',
        returnData[i++],
      )[0];
      const liability = WombatEventPool.assetInterface.decodeFunctionResult(
        'liability',
        returnData[i++],
      )[0];
      poolState.underlyingAddresses.push(tokenAddress);
      poolState.asset[tokenAddress] = {
        cash,
        liability,
      };
    }
    return poolState;
  }

  handleDeposit(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const amountAdded = BigInt(event.args.amount.toString());
    const tokenAddress = event.args.token.toString();

    return {
      ...state,
      asset: {
        ...state.asset,
        [tokenAddress]: {
          cash: state.asset[tokenAddress].cash + amountAdded,
          liability: state.asset[tokenAddress].liability + amountAdded,
        },
      },
    };
  }
  handleWithdraw(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const amountWithdrew = BigInt(event.args.amount.toString());
    const tokenAddress = event.args.token.toString();

    return {
      ...state,
      asset: {
        ...state.asset,
        [tokenAddress]: {
          cash: state.asset[tokenAddress].cash - amountWithdrew,
          liability: state.asset[tokenAddress].liability - amountWithdrew,
        },
      },
    };
  }

  handleSwap(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const fromTokenAddress = event.args.fromToken.toString();
    const fromAmount = BigInt(event.args.fromAmount.toString());
    const toTokenAddress = event.args.toToken.toString();
    const toAmount = BigInt(event.args.toAmount.toString());

    return {
      ...state,
      asset: {
        ...state.asset,
        [fromTokenAddress]: {
          cash: state.asset[fromTokenAddress].cash + fromAmount,
        },
        [toTokenAddress]: {
          cash: state.asset[toTokenAddress].cash - toAmount,
        },
      },
    };
  }
}
