import { DeepReadonly } from 'ts-essentials';
import { PartialEventSubscriber } from '../../composed-event-subscriber';
import {
  Address,
  BlockHeader,
  Log,
  Logger,
  MultiCallInput,
  MultiCallOutput,
} from '../../types';
import { Lens } from '../../lens';
import { Interface } from '@ethersproject/abi';
import ProxyABI from '../../abi/Redstone.json';

export type RedstoneState = {
  answer: bigint;
  timestamp: bigint;
};

export class RedstoneSubscriber<State> extends PartialEventSubscriber<
  State,
  RedstoneState
> {
  static readonly proxyInterface = new Interface(ProxyABI);
  // static readonly ANSWER_UPDATED_TOPIC =
  //     RedstoneSubscriber.proxyInterface.getEventTopic('');

  constructor(
    private proxy: Address,
    private aggregator: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<RedstoneState>>,
    logger: Logger,
  ) {
    super([aggregator], lens, logger);
  }

  static getReadAggregatorMultiCallInput(proxy: Address): MultiCallInput {
    return {
      target: proxy,
      callData: RedstoneSubscriber.proxyInterface.encodeFunctionData(
        'getPriceFeedAdapter',
      ),
    };
  }

  static readAggregator(multicallOutput: MultiCallOutput): Address {
    return RedstoneSubscriber.proxyInterface.decodeFunctionResult(
      'getPriceFeedAdapter',
      multicallOutput,
    )[0];
  }

  static getReadDecimal(proxy: Address): MultiCallInput {
    return {
      target: proxy,
      callData:
        RedstoneSubscriber.proxyInterface.encodeFunctionData('decimals'),
    };
  }

  static readDecimals(multicallOutput: MultiCallOutput): Address {
    return RedstoneSubscriber.proxyInterface.decodeFunctionResult(
      'decimals',
      multicallOutput,
    )[0];
  }

  public processLog(
    state: DeepReadonly<RedstoneState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<RedstoneState> | null {
    // if (log.topics[0] !== RedstoneSubscriber.ANSWER_UPDATED_TOPIC) return null; // Ignore other events
    // const decoded = RedstoneSubscriber.proxyInterface.decodeEventLog(
    //     'AnswerUpdated',
    //     log.data,
    //     log.topics,
    // );
    // return {
    //     answer: BigInt(decoded.current.toString()),
    //     timestamp: BigInt(decoded.updatedAt.toString()),
    // };
    return {
      answer: BigInt('1000000'),
      timestamp: BigInt('1000000'),
    };
  }

  public getGenerateStateMultiCallInputs(): MultiCallInput[] {
    return [
      {
        target: this.proxy,
        callData:
          RedstoneSubscriber.proxyInterface.encodeFunctionData(
            'latestRoundData',
          ),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<RedstoneState> {
    const decoded = RedstoneSubscriber.proxyInterface.decodeFunctionResult(
      'latestRoundData',
      multicallOutputs[0],
    );
    return {
      answer: BigInt(decoded.answer.toString()),
      timestamp: BigInt(decoded.updatedAt.toString()),
    };
  }

  public getLatestRoundData(state: DeepReadonly<State>): bigint {
    return this.lens.get()(state).answer;
  }
}
