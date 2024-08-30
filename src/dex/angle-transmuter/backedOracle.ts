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
import ProxyABI from '../../abi/chainlink.json';
import { ChainLinkState } from '../../lib/chainlink';

export class BackedSubscriber<State> extends PartialEventSubscriber<
  State,
  ChainLinkState
> {
  static readonly proxyInterface = new Interface(ProxyABI);
  static readonly ANSWER_UPDATED_TOPIC =
    BackedSubscriber.proxyInterface.getEventTopic('AnswerUpdated');

  constructor(
    private proxy: Address,
    private aggregator: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<ChainLinkState>>,
    logger: Logger,
  ) {
    super([aggregator], lens, logger);
  }

  static getReadDecimal(proxy: Address): MultiCallInput {
    return {
      target: proxy,
      callData: BackedSubscriber.proxyInterface.encodeFunctionData('decimals'),
    };
  }

  static readDecimals(multicallOutput: MultiCallOutput): Address {
    return BackedSubscriber.proxyInterface.decodeFunctionResult(
      'decimals',
      multicallOutput,
    )[0];
  }

  public processLog(
    state: DeepReadonly<ChainLinkState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<ChainLinkState> | null {
    if (log.topics[0] !== BackedSubscriber.ANSWER_UPDATED_TOPIC) return null; // Ignore other events
    const decoded = BackedSubscriber.proxyInterface.decodeEventLog(
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
          BackedSubscriber.proxyInterface.encodeFunctionData('latestRoundData'),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<ChainLinkState> {
    const decoded = BackedSubscriber.proxyInterface.decodeFunctionResult(
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
