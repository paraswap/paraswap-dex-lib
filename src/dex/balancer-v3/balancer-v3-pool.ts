import _ from 'lodash';
import { Interface, defaultAbiCoder } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  PoolStateMap,
  StableMutableState,
  Step,
  TokenInfo,
} from './types';
import { getPoolsApi } from './getPoolsApi';
import vaultExtensionAbi_V3 from '../../abi/balancer-v3/vault-extension.json';
import { decodeThrowError, getOnChainState } from './getOnChainState';
import { BalancerV3Config } from './config';
import { SwapKind, Vault } from '@paraswap/balancer-maths';
import {
  ampUpdateStartedEvent,
  ampUpdateStoppedEvent,
  getAmplificationParameter,
  isStableMutableState,
} from './stablePool';
import { BI_POWS } from '../../bigint-constants';

const WAD = BI_POWS[18];

export class BalancerV3EventPool extends StatefulEventSubscriber<PoolStateMap> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolStateMap>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolStateMap> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  interfaces: {
    [name: string]: Interface;
  };

  vault: Vault;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(
      parentName,
      BalancerV3Config.BalancerV3[network].vaultAddress,
      dexHelper,
      logger,
    );

    this.interfaces = {
      ['VAULT']: new Interface(vaultExtensionAbi_V3),
      ['STABLE']: new Interface([
        'function getAmplificationParameter() external view returns (uint256 value, bool isUpdating, uint256 precision)',
        'function getAmplificationState() external view returns (tuple(uint64 startValue, uint64 endValue, uint32 startTime, uint32 endTime) amplificationState, uint256 precision)',
      ]),
    };

    this.logDecoder = (log: Log) => this.interfaces['VAULT'].parseLog(log);
    this.addressesSubscribed = [
      BalancerV3Config.BalancerV3[network].vaultAddress,
    ];

    // Add handlers
    this.handlers['LiquidityAdded'] = this.liquidityAddedEvent.bind(this);
    this.handlers['LiquidityRemoved'] = this.liquidityRemovedEvent.bind(this);
    this.handlers['Swap'] = this.swapEvent.bind(this);
    this.handlers['VaultAuxiliary'] = this.vaultAuxiliaryEvent.bind(this);
    this.handlers['AggregateSwapFeePercentageChanged'] =
      this.poolAggregateSwapFeePercentageEvent.bind(this);
    this.handlers['SwapFeePercentageChanged'] =
      this.poolSwapFeePercentageChangedEvent.bind(this);
    this.handlers['PoolPausedStateChanged'] =
      this.poolPausedStateChanged.bind(this);

    // replicates V3 maths with fees, pool and hook logic
    this.vault = new Vault();
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
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
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
  async generateState(
    blockNumber: number,
  ): Promise<DeepReadonly<PoolStateMap>> {
    const block = await this.dexHelper.provider.getBlock(blockNumber);
    const apiPoolStateMap = await getPoolsApi(this.network, block.timestamp);
    const allOnChainPools = await getOnChainState(
      this.network,
      apiPoolStateMap,
      this.dexHelper,
      this.interfaces,
      blockNumber,
    );

    // Filter out all paused pools
    const filteredPools = Object.entries(allOnChainPools)
      .filter(([address, pool]) => {
        return !pool.isPoolPaused;
      })
      .reduce((acc, [address, pool]) => {
        acc[address] = pool;
        return acc;
      }, {} as PoolStateMap);

    return filteredPools;
  }

  async getUpdatedPoolState(
    existingPoolState: DeepReadonly<PoolStateMap>,
  ): Promise<DeepReadonly<PoolStateMap> | null> {
    // Get all latest pools from API
    const apiPoolStateMap = await getPoolsApi(this.network);

    // Filter out pools that already exist in existing state
    const newApiPools = Object.entries(apiPoolStateMap).reduce(
      (acc, [address, pool]) => {
        if (!existingPoolState[address]) {
          acc[address] = pool;
        }
        return acc;
      },
      {} as typeof apiPoolStateMap,
    );

    // If no new pools return
    if (Object.keys(newApiPools).length === 0) {
      return null;
    }

    // Only get on-chain state for new pools
    const newOnChainPools = await getOnChainState(
      this.network,
      newApiPools,
      this.dexHelper,
      this.interfaces,
    );

    // Filter out pools with hooks and paused pools from new state
    // TODO this won't be necessary once API has this filter option
    const filteredNewPools = Object.entries(newOnChainPools)
      .filter(([_, pool]) => !(pool.hasHook || pool.isPoolPaused))
      .reduce((acc, [address, pool]) => {
        acc[address] = pool;
        return acc;
      }, {} as PoolStateMap);

    // Merge existing pools with new pools
    return {
      ...existingPoolState,
      ...filteredNewPools,
    };
  }

  liquidityAddedEvent(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const poolAddress = event.args.pool.toLowerCase();
    // Vault will send events from all pools, some of which are not officially supported by Balancer
    if (!state[poolAddress]) {
      return null;
    }
    const newState = _.cloneDeep(state) as PoolStateMap;
    for (
      let i = 0;
      i < newState[poolAddress].balancesLiveScaled18.length;
      i++
    ) {
      newState[poolAddress].balancesLiveScaled18[i] += this.toScaled18(
        BigInt(event.args.amountsAddedRaw[i]),
        newState[poolAddress].scalingFactors[i],
      );
    }
    newState[poolAddress].totalSupply = BigInt(event.args.totalSupply);

    return newState;
  }

  liquidityRemovedEvent(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const poolAddress = event.args.pool.toLowerCase();
    // Vault will send events from all pools, some of which are not officially supported by Balancer
    if (!state[poolAddress]) {
      return null;
    }
    const newState = _.cloneDeep(state) as PoolStateMap;
    for (
      let i = 0;
      i < newState[poolAddress].balancesLiveScaled18.length;
      i++
    ) {
      newState[poolAddress].balancesLiveScaled18[i] -= this.toScaled18(
        BigInt(event.args.amountsRemovedRaw[i]),
        newState[poolAddress].scalingFactors[i],
      );
    }
    newState[poolAddress].totalSupply = BigInt(event.args.totalSupply);

    return newState;
  }

  swapEvent(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const poolAddress = event.args.pool.toLowerCase();
    // Vault will send events from all pools, some of which are not officially supported by Balancer
    if (!state[poolAddress]) {
      return null;
    }
    const newState = _.cloneDeep(state) as PoolStateMap;
    const tokenInIndex = newState[poolAddress].tokens.findIndex(
      address => address.toLowerCase() === event.args.tokenIn.toLowerCase(),
    );
    const tokenOutIndex = newState[poolAddress].tokens.findIndex(
      address => address.toLowerCase() === event.args.tokenOut.toLowerCase(),
    );
    if (tokenInIndex === -1 || tokenOutIndex === -1) {
      this.logger.error(`swapEvent - token index not found in pool state`);
      return null;
    }
    newState[poolAddress].balancesLiveScaled18[tokenInIndex] += this.toScaled18(
      BigInt(event.args.amountIn),
      newState[poolAddress].scalingFactors[tokenInIndex],
    );
    newState[poolAddress].balancesLiveScaled18[tokenOutIndex] -=
      this.toScaled18(
        BigInt(event.args.amountOut),
        newState[poolAddress].scalingFactors[tokenOutIndex],
      );

    return newState;
  }

  vaultAuxiliaryEvent(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    // In SC Pools can use this event to emit event data from the Vault.
    // Allows us to track pool specific events using only the Vault subscription.
    // https://github.com/balancer/balancer-v3-monorepo/blob/main/pkg/interfaces/contracts/vault/IVaultExtension.sol
    const poolAddress = event.args.pool.toLowerCase();
    // Vault will send events from all pools, some of which are not officially supported by Balancer
    if (!state[poolAddress]) {
      return null;
    }

    const newState = _.cloneDeep(state) as PoolStateMap;
    switch (event.args.eventKey) {
      case 'AmpUpdateStarted':
        ampUpdateStartedEvent(newState[poolAddress], event.args.eventData);
        return newState;
      case 'AmpUpdateStopped':
        ampUpdateStoppedEvent(newState[poolAddress], event.args.eventData);
        return newState;
      default:
        return null;
    }
  }

  poolAggregateSwapFeePercentageEvent(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const poolAddress = event.args.pool.toLowerCase();
    // Vault will send events from all pools, some of which are not officially supported by Balancer
    if (!state[poolAddress]) {
      return null;
    }
    const newState = _.cloneDeep(state) as PoolStateMap;
    newState[poolAddress].aggregateSwapFee = BigInt(
      event.args.aggregateSwapFeePercentage,
    );
    return newState;
  }

  poolSwapFeePercentageChangedEvent(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const poolAddress = event.args.pool.toLowerCase();
    // Vault will send events from all pools, some of which are not officially supported by Balancer
    if (!state[poolAddress]) {
      return null;
    }
    const newState = _.cloneDeep(state) as PoolStateMap;
    newState[poolAddress].swapFee = BigInt(event.args.swapFeePercentage);
    return newState;
  }

  poolPausedStateChanged(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    // Unpaused pools will be added with correct state during updateStatePools
    if (event.args.paused === false) return null;
    const poolAddress = event.args.pool.toLowerCase();
    // Vault will send events from all pools, some of which are not officially supported by Balancer
    if (!state[poolAddress]) {
      return null;
    }
    // Remove paused pool from state as it can't be swapped against
    const newState = _.cloneDeep(state) as PoolStateMap;
    delete newState[poolAddress];
    return newState;
  }

  getMaxSwapAmount(
    pool: PoolState,
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    swapKind: SwapKind,
  ): bigint {
    // Find the maximum swap amount the pool will support
    const maxSwapAmount = this.vault.getMaxSwapAmount(
      {
        swapKind,
        balancesLiveScaled18: pool.balancesLiveScaled18,
        tokenRates: pool.tokenRates,
        scalingFactors: pool.scalingFactors,
        indexIn: tokenIn.index,
        indexOut: tokenOut.index,
      },
      pool,
    );
    return maxSwapAmount;
  }

  getSwapResult(
    steps: Step[],
    amountRaw: bigint,
    swapKind: SwapKind,
    timestamp: number,
  ): bigint {
    if (amountRaw === 0n) return 0n;

    // A GivenOut needs to use steps in reverse during calculation
    const indices =
      swapKind === SwapKind.GivenIn
        ? steps.keys()
        : Array.from(steps.keys()).reverse();

    let amount = amountRaw;
    let outputAmountRaw = 0n;
    for (const i of indices) {
      const step = steps[i];
      // If its a Stable Pool with an updating Amp factor calculate current Amp value
      if (
        step.poolState.poolType === 'STABLE' &&
        isStableMutableState(step.poolState)
      ) {
        if (step.poolState.ampIsUpdating) {
          step.poolState.amp = getAmplificationParameter(
            step.poolState.ampStartValue,
            step.poolState.ampEndValue,
            step.poolState.ampStartTime,
            step.poolState.ampStopTime,
            BigInt(timestamp),
          );
        }
      }
      outputAmountRaw = this.vault.swap(
        {
          ...step.swapInput,
          amountRaw: amount,
          swapKind,
        },
        step.poolState,
      );
      // Next step uses output from previous step as input
      amount = outputAmountRaw;
    }
    return outputAmountRaw;
  }

  /**
   * Retrieves any new pools via API/multicall and adds to state
   */
  async updateStatePools(): Promise<void> {
    const blockNumber = await this.dexHelper.provider.getBlockNumber();
    // We just want the current saved state
    const currentState = this.getStaleState() || {};
    const updatedPoolState = await this.getUpdatedPoolState(currentState);
    if (updatedPoolState) this.setState(updatedPoolState, blockNumber);
  }

  /**
   * Uses multicall to get onchain token rate for each pool then updates pool state
   */
  async updateStatePoolRates(): Promise<void> {
    // Get existing state
    const poolState = _.cloneDeep(this.getStaleState()) as PoolStateMap;
    if (!poolState) return;

    // Fetch onchain pool rates
    const poolRates = await this.getPoolRates(Object.keys(poolState));

    // Update each pools rate
    poolRates.forEach(({ poolAddress, tokenRates }, i) => {
      poolState[poolAddress].tokenRates = tokenRates;
    });

    // Update state
    const blockNumber = await this.dexHelper.provider.getBlockNumber();
    this.setState(poolState, blockNumber);
  }

  private async getPoolRates(poolAddresses: string[]) {
    // For each pool make the getPoolTokenRates call
    const multiCallData = poolAddresses.map(address => {
      return {
        target: BalancerV3Config.BalancerV3[this.network].vaultAddress,
        callData: this.interfaces['VAULT'].encodeFunctionData(
          'getPoolTokenRates',
          [address],
        ),
      };
    });
    // 500 is an arbitrary number chosen based on the blockGasLimit
    const slicedMultiCallData = _.chunk(multiCallData, 500);

    // Make the multicall
    const multicallData = (
      await Promise.all(
        slicedMultiCallData.map(async _multiCallData =>
          this.dexHelper.multiContract.methods
            .tryAggregate(false, _multiCallData)
            .call({}),
        ),
      )
    ).flat();

    return poolAddresses.map((address, i) => {
      const tokenRateResult = decodeThrowError(
        this.interfaces['VAULT'],
        'getPoolTokenRates',
        multicallData[i],
        address,
      );
      return {
        poolAddress: address,
        tokenRates: tokenRateResult.tokenRates.map((r: string) => BigInt(r)),
      };
    });
  }

  // If a token is "boosted" it can be auto wrapped/unwrapped by Vault, e.g. aDAI<>DAI
  // mainToken is the actual token the pool would contain, e.g. in a bbausd type setup it would be aDAI/aUSDC/aUSDT
  // underlyingToken would be the unwrapped, e.g. DAI/USDC/USDT
  // need rate info to calculate wrap/unwrap
  getTokenInfo(poolState: PoolState, tokenAddress: string): TokenInfo | null {
    // Check in main tokens
    let tokenIndex = poolState.tokens.findIndex(
      address => address.toLowerCase() === tokenAddress.toLowerCase(),
    );
    if (tokenIndex !== -1) {
      return {
        isBoosted: false,
        mainToken: tokenAddress,
        underlyingToken: null,
        index: tokenIndex,
        rate: poolState.tokenRates[tokenIndex],
      };
    }

    // Check in underlying tokens if available
    if (poolState.tokensUnderlying) {
      tokenIndex = poolState.tokensUnderlying.findIndex(
        address =>
          address && address.toLowerCase() === tokenAddress.toLowerCase(),
      );
      if (tokenIndex !== -1) {
        return {
          isBoosted: true,
          mainToken: poolState.tokens[tokenIndex],
          underlyingToken: tokenAddress,
          index: tokenIndex,
          rate: poolState.tokenRates[tokenIndex],
        };
      }
    }

    // Token not found
    this.logger.error(`getTokenInfo token not found`);
    return null;
  }

  /**
   * Prepares all the step data required to simulate maths and construct swap transaction.
   * Balancer V3 has the concepts of Boosted Pools and ERC4626 Liquidity Buffers.
   * These enable highly capital efficient pools and gas efficient swaps.
   * To swap via a buffer we must provide the correct ""steps" to the router transaction.
   * Wrap: e.g. USDC>aUSDC
   * Unwrap: e.g. aUSDC>USDC
   * A full swap between USDC>DAI for an example bbausd pool consisting of aDAI/aUSDC/aUSDT would look like:
   * USDC[wrap-buffer]aUSDC[swap-pool]aDAI[unwrap-buffer]USDC
   * See docs for further info:
   * https://docs-v3.balancer.fi/concepts/explore-available-balancer-pools/boosted-pool.html
   * https://docs-v3.balancer.fi/concepts/vault/buffer.html
   */
  getSteps(pool: PoolState, tokenIn: TokenInfo, tokenOut: TokenInfo): Step[] {
    if (tokenIn.isBoosted && tokenOut.isBoosted) {
      return [
        // Wrap tokenIn underlying to main token
        this.getWrapStep(tokenIn),
        // Swap main > main
        this.getSwapStep(pool, tokenIn, tokenOut),
        // Unwrap tokenOut main to underlying token
        this.getUnwrapStep(tokenOut),
      ];
    } else if (tokenIn.isBoosted) {
      if (tokenIn.mainToken === tokenOut.mainToken) {
        // wrap, token > erc4626
        // tokenIn is boosted, e.g. isn't pool token and must be wrapped
        return [this.getWrapStep(tokenIn)];
      }
      return [
        // Wrap tokenIn underlying to main token
        this.getWrapStep(tokenIn),
        // Swap main > main
        this.getSwapStep(pool, tokenIn, tokenOut),
      ];
    } else if (tokenOut.isBoosted) {
      if (tokenIn.mainToken === tokenOut.mainToken) {
        // unwrap, stata > token
        // token out is boosted, e.g. isn't pool token
        return [this.getUnwrapStep(tokenOut)];
      }
      return [
        // Swap main > main
        this.getSwapStep(pool, tokenIn, tokenOut),
        // Unwrap tokenOut main to underlying token
        this.getUnwrapStep(tokenOut),
      ];
    } else {
      return [
        // Swap main > main
        this.getSwapStep(pool, tokenIn, tokenOut),
      ];
    }
  }

  getWrapStep(token: TokenInfo): Step {
    if (!token.underlyingToken)
      throw new Error(
        `Buffer wrap: token has no underlying. ${token.mainToken}`,
      );
    // Vault expects pool to be the ERC4626 wrapped token, e.g. aUSDC
    return {
      pool: token.mainToken,
      isBuffer: true,
      swapInput: {
        tokenIn: token.underlyingToken,
        tokenOut: token.mainToken,
      },
      poolState: {
        poolType: 'Buffer',
        rate: token.rate,
        poolAddress: token.mainToken,
        tokens: [token.mainToken, token.underlyingToken], // staticToken & underlying
      },
    };
  }

  getUnwrapStep(token: TokenInfo): Step {
    if (!token.underlyingToken)
      throw new Error(
        `Buffer unwrap: token has no underlying. ${token.mainToken}`,
      );
    // Vault expects pool to be the ERC4626 wrapped token, e.g. aUSDC
    return {
      pool: token.mainToken,
      isBuffer: true,
      swapInput: {
        tokenIn: token.mainToken,
        tokenOut: token.underlyingToken,
      },
      poolState: {
        poolType: 'Buffer',
        // TODO: for ERC4626 fetch the wrap/unwrap rate
        rate: token.rate,
        poolAddress: token.mainToken,
        tokens: [token.mainToken, token.underlyingToken], // staticToken & underlying
      },
    };
  }

  getSwapStep(pool: PoolState, tokenIn: TokenInfo, tokenOut: TokenInfo): Step {
    // A normal swap between two tokens in a pool
    return {
      pool: pool.poolAddress,
      isBuffer: false,
      swapInput: {
        tokenIn: tokenIn.mainToken,
        tokenOut: tokenOut.mainToken,
      },
      poolState: pool,
    };
  }

  toScaled18(amount: bigint, scalingFactor: bigint): bigint {
    return (amount * scalingFactor * WAD) / WAD;
  }
}
