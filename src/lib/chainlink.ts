import { DeepReadonly } from 'ts-essentials';
import { PartialEventSubscriber } from '../composed-event-subscriber';
import {
  Address,
  BlockHeader,
  Log,
  Logger,
  MultiCallInput,
  MultiCallOutput,
} from '../types';
import { Lens } from '../lens';
import { Interface } from '@ethersproject/abi';
import ProxyABI from '../abi/chainlink.json';

export type ChainLinkState = {
  answer: bigint;
  timestamp: bigint;
};

export class ChainLinkSubscriber<State> extends PartialEventSubscriber<
  State,
  ChainLinkState
> {
  static readonly proxyInterface = new Interface(ProxyABI);
  static readonly ANSWER_UPDATED_TOPIC =
    ChainLinkSubscriber.proxyInterface.getEventTopic('AnswerUpdated');

  constructor(
    private proxy: Address,
    private aggregator: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<ChainLinkState>>,
    logger: Logger,
  ) {
    super([aggregator], lens, logger);
  }

  static getReadAggregatorMultiCallInput(proxy: Address): MultiCallInput {
    return {
      target: proxy,
      callData:
        ChainLinkSubscriber.proxyInterface.encodeFunctionData('aggregator'),
    };
  }

  static readAggregator(multicallOutput: MultiCallOutput): Address {
    return ChainLinkSubscriber.proxyInterface.decodeFunctionResult(
      'aggregator',
      multicallOutput,
    )[0];
  }

  public processLog(
    state: DeepReadonly<ChainLinkState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<ChainLinkState> | null {
    if (log.topics[0] !== ChainLinkSubscriber.ANSWER_UPDATED_TOPIC) return null; // Ignore other events
    const decoded = ChainLinkSubscriber.proxyInterface.decodeEventLog(
      'AnswerUpdated',
      log.data,
      log.topics,
    );
    return {
      answer: BigInt(decoded.current.toString()),
      timestamp: BigInt(decoded.updatedAt.toString()),
    };
  }

  public getGenerateStateMultiCallInputs(): MultiCallInput[] {
    return [
      {
        target: this.proxy,
        callData:
          ChainLinkSubscriber.proxyInterface.encodeFunctionData(
            'latestRoundData',
          ),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<ChainLinkState> {
    const decoded = ChainLinkSubscriber.proxyInterface.decodeFunctionResult(
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
