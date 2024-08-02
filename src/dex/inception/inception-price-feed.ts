import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
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
import { PoolState } from './types';
import INCEPTION_RATIO_FEED from '../../abi/inception/inception-ratio-feed.json';
import { getTokenFromAddress } from './tokens';
import { Network } from '../../constants';

export class InceptionPriceFeed<State> extends PartialEventSubscriber<
  State,
  PoolState
> {
  protected ratioFeedInterface: Interface = new Interface(INCEPTION_RATIO_FEED);
  constructor(
    private ratioFeedAddress: Address,
    private network: Network,
    lens: Lens<DeepReadonly<State>, DeepReadonly<PoolState>>,
    logger: Logger,
  ) {
    super([ratioFeedAddress], lens, logger);
  }

  getRatio(state: DeepReadonly<State>) {
    return this.lens.get()(state).ratio;
  }

  public processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PoolState> | null {
    try {
      const parsed = this.ratioFeedInterface.parseLog(log);
      const _state: PoolState = _.cloneDeep(state);
      switch (parsed.name) {
        case 'RatioUpdated': {
          const tokenInfo = getTokenFromAddress(this.network, parsed.args[0]);
          _state[tokenInfo.symbol.toLowerCase()] = {
            ratio: BigInt(parsed.args[2].toString()),
          };
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
  ): DeepReadonly<PoolState> {
    return {};
  }
}
