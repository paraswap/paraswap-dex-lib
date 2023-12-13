import _ from 'lodash';
import { Interface, JsonFragment } from '@ethersproject/abi';
import { DeepReadonly, assert } from 'ts-essentials';
import { Address, BlockHeader, Log, Logger } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DFXPoolConfig } from './types';
import CurvepoolABI from '../../abi/dfx/Curve-pool.json';
import { DfxConfig } from './config';
import erc20ABI from '../../abi/erc20.json';
import { typeCastPoolState } from '../nerve/utils';
import { PoolState } from '../nerve/types';
import { DecodedStateMultiCallResultWithRelativeBitmaps } from '../uniswap-v3/types';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { Contract } from 'web3-eth-contract';
import { uint256ToBigInt } from '../../lib/decoders';

export class DfxEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: PoolState,
      log: Log,
      blockHeader: Readonly<BlockHeader>,
    ) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;
  public readonly poolIface = new Interface(CurvepoolABI);
  lpTokenIface: Interface;

  addressesSubscribed: string[];
  private _poolAddress?: Address;

  public readonly feeCodeAsString;

  private _stateRequestCallData?: MultiCallParams<
    bigint | DecodedStateMultiCallResultWithRelativeBitmaps
  >[];

  readonly token0: Address;

  readonly token1: Address;

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    readonly stateMultiContract: Contract,
    readonly erc20Interface: Interface,
    protected readonly factoryAddress: Address,
    public readonly feeCode: bigint,
    token0: Address,
    token1: Address,
    logger: Logger,
    mapKey: string = '',
    readonly poolInitCodeHash: string,
    readonly poolDeployer?: string,
  ) {
    // TODO: Add pool name
    super(
      parentName,
      `${token0}_${token1}_${feeCode}`,
      dexHelper,
      logger,
      true,
      mapKey,
    );
    this.feeCodeAsString = feeCode.toString();
    this.feeCodeAsString = feeCode.toString();
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();
    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
    ];

    // Add handlers
    this.handlers['Swap'] = this.handleTokenSwap.bind(this);
    this.lpTokenIface = new Interface(JSON.stringify(erc20ABI));
  }
  private _getStateRequestCallData() {
    if (!this._stateRequestCallData) {
      const callData: MultiCallParams<
        bigint | DecodedStateMultiCallResultWithRelativeBitmaps
      >[] = [
        {
          target: this.token0,
          callData: this.erc20Interface.encodeFunctionData('balanceOf', [
            this.poolAddress,
          ]),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.token1,
          callData: this.erc20Interface.encodeFunctionData('balanceOf', [
            this.poolAddress,
          ]),
          decodeFunction: uint256ToBigInt,
        },
      ];
      this._stateRequestCallData = callData;
    }
    return this._stateRequestCallData;
  }

  // get tokens() {
  //   return this.poolConfig.coins;
  // }

  // get lpToken() {
  //   return this.poolConfig.lpToken;
  // }
  // get numTokens() {
  //   return this.tokens.length;
  // }

  // get tokenPrecisionMultipliers() {
  //   return this.tokens.map(
  //     token => bigIntify(10) ** (BigInt(1) - bigIntify(token.decimals)),
  //   );
  // }

  get poolAddress() {
    // if (this._poolAddress === undefined) {
    //   this._poolAddress = this._computePoolAddress(
    //     this.token0,
    //     this.token1,
    //     this.feeCode,
    //   );
    // }
    return this._poolAddress;
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
  processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> {
    try {
      const event = this.logDecoder(log);
      const _state: PoolState = typeCastPoolState(state);
      if (event.name in this.handlers)
        return this.handlers[event.name](event, _state, log, blockHeader);
      return state;
    } catch (e) {
      this.logger.error(`Unexpected error handling log:`, e);
    }
    return state;
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
    const callData = this._getStateRequestCallData();

    const [resBalance0, resBalance1, resState] =
      await this.dexHelper.multiWrapper.tryAggregate<
        bigint | DecodedStateMultiCallResultWithRelativeBitmaps
      >(
        false,
        callData,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      );

    // Quite ugly solution, but this is the one that fits to current flow.
    // I think UniswapV3 callbacks subscriptions are complexified for no reason.
    // Need to be revisited later
    assert(resState.success, 'Pool does not exist');

    const [balance0, balance1, _state] = [
      resBalance0.returnData,
      resBalance1.returnData,
      resState.returnData,
    ] as [bigint, bigint, DecodedStateMultiCallResultWithRelativeBitmaps];

    const tickBitmap = {};
    const ticks = {};

    // _reduceTickBitmap(tickBitmap, _state.tickBitmap);
    // _reduceTicks(ticks, _state.ticks);

    const observations = {
      [_state.slot0.observationIndex]: {
        blockTimestamp: bigIntify(_state.observation.blockTimestamp),
        tickCumulative: bigIntify(_state.observation.tickCumulative),
        secondsPerLiquidityCumulativeX128: bigIntify(
          _state.observation.secondsPerLiquidityCumulativeX128,
        ),
        initialized: _state.observation.initialized,
      },
    };

    const currentTick = bigIntify(_state.slot0.tick);
    const tickSpacing = bigIntify(_state.tickSpacing);

    return {
      pool: _state.pool,
      blockTimestamp: bigIntify(_state.blockTimestamp),
      liquidity: bigIntify(_state.liquidity),
      fee: this.feeCode,
      isValid: true,
      balance0,
      balance1,
    };
  }

  // Its just a dummy example
  handleMyEvent(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }

  handleTokenSwap(
    event: any,
    pool: PoolState,
    log: Log,
    blockHeader: BlockHeader,
  ) {
    const newSqrtPriceX96 = bigIntify(event.args.sqrtPriceX96);
    const amount0 = bigIntify(event.args.amount0);
    const amount1 = bigIntify(event.args.amount1);
    const newTick = bigIntify(event.args.tick);
    const newLiquidity = bigIntify(event.args.liquidity);
    // const protocolFeesToken0 = bigIntify(event.arg.protocolFeesToken0);
    // const protocolFeesToken1 = bigIntify(event.arg.protocolFeesToken1);

    pool.blockTimestamp = bigIntify(blockHeader.timestamp);
    if (amount0 <= 0n && amount1 <= 0n) {
      this.logger.error(
        `${this.parentName}: amount0 <= 0n && amount1 <= 0n for ` +
          `${this.poolAddress} and ${blockHeader.number}. Check why it happened`,
      );
      pool.isValid = false;
      return pool;
    } else {
      const zeroForOne = amount0 > 0n;

      //@DEV add DFX MATH calculation

      if (zeroForOne) {
        if (amount1 < 0n) {
          pool.balance1 -= BigInt.asUintN(256, -amount1);
        } else {
          this.logger.error(
            `In swapEvent for pool ${pool.pool} received incorrect values ${zeroForOne} and ${amount1}`,
          );
          pool.isValid = false;
        }
        // This is not correct fully, because pool may get more tokens then it needs, but
        // it is not accounted in internal state, it should be good enough
        pool.balance0 += BigInt.asUintN(256, amount0);
      } else {
        if (amount0 < 0n) {
          pool.balance0 -= BigInt.asUintN(256, -amount0);
        } else {
          this.logger.error(
            `In swapEvent for pool ${pool.pool} received incorrect values ${zeroForOne} and ${amount0}`,
          );
          pool.isValid = false;
        }
        pool.balance1 += BigInt.asUintN(256, amount1);
      }

      return pool;
    }
  }
}
