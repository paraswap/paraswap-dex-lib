import { Interface } from '@ethersproject/abi';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import {
  Address,
  Log,
  Logger,
  MultiCallInput,
  MultiCallOutput,
} from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper';
import { AssetState, PoolState } from './types';
import PoolABI from '../../abi/wombat/pool.json';
import AssetABI from '../../abi/wombat/asset.json';

export class WombatEventPool extends StatefulEventSubscriber<PoolState> {
  static readonly poolInterface = new Interface(PoolABI);
  static readonly assetInterface = new Interface(AssetABI);

  private readonly logDecoder: (log: Log) => any;
  private handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => AsyncOrSync<DeepReadonly<PoolState> | null>;
  } = {};

  blankState: PoolState = {
    asset: {},
    underlyingAddresses: [],
    params: {
      paused: false,
      ampFactor: 0n,
      haircutRate: 0n,
      startCovRatio: 0n,
      endCovRatio: 0n,
    },
  };

  constructor(
    dexKey: string,
    name: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected poolAddress: Address,
  ) {
    super(
      `${dexKey} ${name}`,
      `${dexKey}-${network} ${name}`,
      dexHelper,
      logger,
    );

    this.logDecoder = (log: Log) => WombatEventPool.poolInterface.parseLog(log);
    this.addressesSubscribed = [this.poolAddress];

    // users-actions handlers
    this.handlers['Deposit'] = this.handleDeposit.bind(this);
    this.handlers['Withdraw'] = this.handleWithdraw.bind(this);
    this.handlers['Swap'] = this.handleSwap.bind(this);

    // admin-actions handlers
    this.handlers['SetAmpFactor'] = this.handleSetAmpFactor.bind(this);
    this.handlers['SetHaircutRate'] = this.handleSetHaircutRate.bind(this);

    this.handlers['AssetAdded'] = this.handleAssetAdded.bind(this);
    this.handlers['AssetRemoved'] = this.handleAssetRemoved.bind(this);
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
  protected async processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return await this.handlers[event.name](event, state, log);
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
    let multiCallInputs: MultiCallInput[] = [];
    // 1 A. pool params
    // paused
    multiCallInputs.push({
      target: this.poolAddress,
      callData: WombatEventPool.poolInterface.encodeFunctionData('paused'),
    });
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
    // startCovRatio
    multiCallInputs.push({
      target: this.poolAddress,
      callData:
        WombatEventPool.poolInterface.encodeFunctionData('startCovRatio'),
    });
    // endCovRatio
    multiCallInputs.push({
      target: this.poolAddress,
      callData: WombatEventPool.poolInterface.encodeFunctionData('endCovRatio'),
    });
    // tokens
    multiCallInputs.push({
      target: this.poolAddress,
      callData: WombatEventPool.poolInterface.encodeFunctionData('getTokens'),
    });

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
    const paused = Boolean(
      WombatEventPool.poolInterface.decodeFunctionResult(
        'paused',
        returnData[i++],
      )[0],
    );
    const ampFactor = BigInt(
      WombatEventPool.poolInterface.decodeFunctionResult(
        'ampFactor',
        returnData[i++],
      )[0],
    );
    const haircutRate = BigInt(
      WombatEventPool.poolInterface.decodeFunctionResult(
        'haircutRate',
        returnData[i++],
      )[0],
    );
    const startCovRatio = BigInt(
      WombatEventPool.poolInterface.decodeFunctionResult(
        'startCovRatio',
        returnData[i++],
      )[0],
    );
    const endCovRatio = BigInt(
      WombatEventPool.poolInterface.decodeFunctionResult(
        'endCovRatio',
        returnData[i++],
      )[0],
    );

    const tokens = WombatEventPool.poolInterface
      .decodeFunctionResult('getTokens', returnData[i++])[0]
      .map((tokenAddress: Address) => tokenAddress.toLowerCase());

    const poolState: PoolState = {
      params: {
        paused,
        ampFactor,
        haircutRate,
        startCovRatio,
        endCovRatio,
      },
      underlyingAddresses: tokens,
      asset: {},
    };

    // 1 B. asset state: cash and liability
    multiCallInputs = tokens.map((tokenAddress: Address) => ({
      target: this.poolAddress,
      callData: WombatEventPool.poolInterface.encodeFunctionData(
        'addressOfAsset',
        [tokenAddress],
      ),
    }));

    // 2. Decode MultiCallOutput
    returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(multiCallInputs)
        .call({}, blockNumber)
    ).returnData;

    const assets: Address[] = returnData.map(data => {
      return WombatEventPool.poolInterface.decodeFunctionResult(
        'addressOfAsset',
        data,
      )[0];
    });

    const assetState = await this.getAssetState(
      this.poolAddress,
      assets,
      tokens,
      blockNumber,
    );
    const isMainPool =
      assetState.filter(asset => asset.relativePrice === undefined).length > 0;
    for (let j = 0; j < tokens.length; j++) {
      if (isMainPool) {
        assetState[j].relativePrice = undefined;
      }
      poolState.asset[tokens[j]] = assetState[j];
    }

    return poolState;
  }

  handleDeposit(
    event: any,
    state: DeepReadonly<PoolState>,
    _log: Readonly<Log>,
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
    _log: Readonly<Log>,
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
    _log: Readonly<Log>,
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

  handleSetAmpFactor(
    event: any,
    state: DeepReadonly<PoolState>,
    _log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const ampFactor = BigInt(event.args.value.toString());

    return {
      ...state,
      params: {
        ...state.params,
        ampFactor,
      },
    };
  }

  handleSetHaircutRate(
    event: any,
    state: DeepReadonly<PoolState>,
    _log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    const haircutRate = BigInt(event.args.value.toString());

    return {
      ...state,
      params: {
        ...state.params,
        haircutRate,
      },
    };
  }

  async handleAssetAdded(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    const token: Address = event.args.token.toString().toLowerCase();
    const asset: Address = event.args.asset.toString().toLowerCase();
    if (state.underlyingAddresses.includes(token)) {
      return null;
    }

    const assetState = await this.getAssetState(
      this.poolAddress,
      [asset],
      [token],
      log.blockNumber,
    );
    const poolState = {
      ...state,
      underlyingAddresses: [...state.underlyingAddresses, token],
      asset: {
        ...state.asset,
        [token]: assetState[0],
      },
    };

    const isMainPool =
      Object.values(poolState.asset).filter(
        asset => asset.relativePrice === undefined,
      ).length > 0;
    if (isMainPool) {
      for (const underlyingAddress of poolState.underlyingAddresses) {
        poolState.asset[underlyingAddress] = {
          ...poolState.asset[underlyingAddress],
          relativePrice: undefined,
        };
      }
    }
    return poolState;
  }

  async handleAssetRemoved(
    event: any,
    state: DeepReadonly<PoolState>,
    _log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    const token = event.args.token.toString();
    if (!state.underlyingAddresses.includes(token)) {
      return null;
    }

    return {
      ...state,
      underlyingAddresses: state.underlyingAddresses.filter(
        underlyingAddress => underlyingAddress !== token,
      ),
      asset: {
        ...state.asset,
        [token]: undefined,
      },
    };
  }

  private async getAssetState(
    pool: Address,
    assets: Address[],
    tokens: Address[],
    blockNumber: number,
  ): Promise<AssetState[]> {
    const assetStates: AssetState[] = [];
    const multiCallInputs: MultiCallInput[] = [];

    const methods = [
      'cash',
      'liability',
      'underlyingTokenDecimals',
      'getRelativePrice',
    ];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const token = tokens[i];

      multiCallInputs.push({
        target: pool,
        callData: WombatEventPool.poolInterface.encodeFunctionData('isPaused', [
          token,
        ]),
      });

      for (const method of methods) {
        multiCallInputs.push({
          target: asset,
          callData: WombatEventPool.assetInterface.encodeFunctionData(method),
        });
      }
    }

    const returnData = await this.dexHelper.multiContract.methods
      .tryAggregate(false, multiCallInputs)
      .call({}, blockNumber);

    for (
      let i = 0;
      i < assets.length * (methods.length + 1);
      i += methods.length + 1
    ) {
      const paused = returnData[i].success
        ? Boolean(
            WombatEventPool.poolInterface.decodeFunctionResult(
              'isPaused',
              returnData[i].returnData,
            )[0],
          )
        : false;
      const cash = BigInt(
        WombatEventPool.assetInterface.decodeFunctionResult(
          methods[0],
          returnData[i + 1].returnData,
        )[0],
      );
      const liability = BigInt(
        WombatEventPool.assetInterface.decodeFunctionResult(
          methods[1],
          returnData[i + 2].returnData,
        )[0],
      );
      const underlyingTokenDecimals =
        WombatEventPool.assetInterface.decodeFunctionResult(
          methods[2],
          returnData[i + 3].returnData,
        )[0];

      let relativePrice: bigint | undefined;
      if (returnData[i + 4].success) {
        relativePrice = BigInt(
          WombatEventPool.assetInterface.decodeFunctionResult(
            methods[3],
            returnData[i + 4].returnData,
          )[0],
        );
      }

      assetStates.push({
        paused,
        cash,
        liability,
        underlyingTokenDecimals,
        relativePrice,
      });
    }

    return assetStates;
  }
}
