import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import GSM_ABI from '../../abi/aave-gsm/Aave_GSM.json';
import FEE_STRATEGY_ABI from '../../abi/aave-gsm/IFeeStrategy.json';
import {
  addressDecode,
  booleanDecode,
  uint256ToBigInt,
} from '../../lib/decoders';

export class AaveGsmEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => Promise<DeepReadonly<PoolState> | null>;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly gsm: string,
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected aaveGsmIface = new Interface(GSM_ABI),
    protected feeStrategyIface = new Interface(FEE_STRATEGY_ABI),
    protected PERCENT_FACTOR = 10_000n,
  ) {
    super(parentName, `${parentName}_${gsm}`, dexHelper, logger);

    this.logDecoder = (log: Log) => this.aaveGsmIface.parseLog(log);
    this.addressesSubscribed = [gsm];

    // Add handlers
    this.handlers['FeeStrategyUpdated'] =
      this.handleFeeStrategyUpdated.bind(this);

    this.handlers['SwapFreeze'] = this.handleSwapFreeze.bind(this);
    this.handlers['Seized'] = this.handleSeized.bind(this);
    this.handlers['ExposureCapUpdated'] =
      this.handleExposureCapUpdated.bind(this);
    this.handlers['BuyAsset'] = this.handleBuyAsset.bind(this);
    this.handlers['SellAsset'] = this.handleSellAsset.bind(this);
  }

  getIdentifier(): string {
    return `${this.parentName}_${this.gsm}`;
  }

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

  async getOnChainState(
    address: string,
    blockNumber: number | string = 'latest',
  ): Promise<PoolState> {
    const callData = [
      {
        target: address,
        callData: this.feeStrategyIface.encodeFunctionData('getBuyFee', [
          this.PERCENT_FACTOR,
        ]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: address,
        callData: this.feeStrategyIface.encodeFunctionData('getSellFee', [
          this.PERCENT_FACTOR,
        ]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.gsm,
        callData: this.aaveGsmIface.encodeFunctionData(
          'getAvailableLiquidity',
          [],
        ),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.gsm,
        callData: this.aaveGsmIface.encodeFunctionData('getIsFrozen', []),
        decodeFunction: booleanDecode,
      },
      {
        target: this.gsm,
        callData: this.aaveGsmIface.encodeFunctionData('getIsSeized', []),
        decodeFunction: booleanDecode,
      },
      {
        target: this.gsm,
        callData: this.aaveGsmIface.encodeFunctionData('getExposureCap', []),
        decodeFunction: uint256ToBigInt,
      },
    ];

    const results = await this.dexHelper.multiWrapper.tryAggregate<
      bigint | boolean
    >(true, callData, blockNumber);

    return {
      buyFee: results[0].returnData as bigint,
      sellFee: results[1].returnData as bigint,
      underlyingLiquidity: results[2].returnData as bigint,
      isFrozen: results[3].returnData as boolean,
      isSeized: results[4].returnData as boolean,
      exposureCap: results[5].returnData as bigint,
    };
  }

  async generateState(
    blockNumber: number | string = 'latest',
  ): Promise<DeepReadonly<PoolState>> {
    const callData = [
      {
        target: this.gsm,
        callData: this.aaveGsmIface.encodeFunctionData('getFeeStrategy', []),
        decodeFunction: addressDecode,
      },
    ];

    const feeStrategy = await this.dexHelper.multiWrapper.tryAggregate<string>(
      true,
      callData,
      blockNumber,
    );

    const result = await this.getOnChainState(
      feeStrategy[0].returnData,
      blockNumber,
    );

    return result;
  }

  async handleFeeStrategyUpdated(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    return await this.getOnChainState(event.args.newFeeStrategy);
  }

  async handleSwapFreeze(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    return {
      ...state,
      isFrozen: event.args.enabled,
    };
  }

  async handleSeized(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    return {
      ...state,
      isSeized: true,
      exposureCap: BigInt(0),
      underlyingLiquidity: BigInt(0),
    };
  }

  async handleExposureCapUpdated(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    return {
      ...state,
      exposureCap: BigInt(event.args.newExposureCap),
    };
  }

  async handleBuyAsset(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    return {
      ...state,
      underlyingLiquidity:
        state.underlyingLiquidity - BigInt(event.args.underlyingAmount),
    };
  }

  async handleSellAsset(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    return {
      ...state,
      underlyingLiquidity:
        state.underlyingLiquidity + BigInt(event.args.underlyingAmount),
    };
  }
}
