import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { PartialEventSubscriber } from '../../composed-event-subscriber';
import {
  Address,
  MultiCallInput,
  MultiCallOutput,
  Logger,
  Log,
  BlockHeader,
} from '../../types';
import { Lens } from '../../lens';
import { ChainLinkPriceFeedState } from './types';
import { convertToNewDecimals } from './utils';
import ChainlinkAccessControlledOffchainAggregatorABI from '../../abi/jarvis/ChainlinkAccessControlledOffchainAggregator.json';
import { bigIntify } from '../../utils';

export class ChainLinkPriceFeed<State> extends PartialEventSubscriber<
  State,
  ChainLinkPriceFeedState
> {
  protected chainLinkInterface: Interface = new Interface(
    ChainlinkAccessControlledOffchainAggregatorABI,
  );
  constructor(
    private chainLinkAddress: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<ChainLinkPriceFeedState>>,
    logger: Logger,
  ) {
    super([chainLinkAddress], lens, logger);
  }

  getUSDPrice(state: DeepReadonly<State>) {
    return this.lens.get()(state).usdcPrice;
  }

  public processLog(
    state: DeepReadonly<ChainLinkPriceFeedState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<ChainLinkPriceFeedState> | null {
    try {
      const parsed = this.chainLinkInterface.parseLog(log);
      const _state: ChainLinkPriceFeedState = _.cloneDeep(state);
      switch (parsed.name) {
        case 'AnswerUpdated': {
          _state.usdcPrice = convertToNewDecimals(
            bigIntify(parsed.args.current.toString()),
            8,
            18,
          );
          return _state;
        }
        default:
          return null;
      }
    } catch (e) {
      this.logger.error('Failed to parse log', e);
      return null;
    }
  }

  public getGenerateStateMultiCallInputs(): MultiCallInput[] {
    return [];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<ChainLinkPriceFeedState> {
    return {
      usdcPrice: 0n,
    };
  }
}
