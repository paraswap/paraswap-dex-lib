import _ from 'lodash';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { BlockHeader, Log, Logger } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolConfig, PoolState } from './types';
import { getOnChainState } from './utils';
import { Interface } from '@ethersproject/abi';
import INCEPTION_RATIO_FEED from '../../abi/inception/inception-ratio-feed.json';
import { getTokenFromAddress } from './tokens';

export class InceptionEventPool extends StatefulEventSubscriber<PoolState> {
  protected ratioFeedInterface: Interface = new Interface(INCEPTION_RATIO_FEED);
  constructor(
    parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public poolConfig: PoolConfig,
    public poolInterface: Interface,
  ) {
    super(parentName, 'pool', dexHelper, logger);

    this.addressesSubscribed = [poolConfig.ratioFeedAddress];
  }

  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): AsyncOrSync<DeepReadonly<PoolState> | null> {
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
          return _state;
      }
    } catch (e) {
      this.logger.error('Failed to parse log', e);
      return null;
    }
  }

  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    return getOnChainState(
      this.dexHelper.multiContract,
      this.poolInterface,
      this.network,
      blockNumber,
    );
  }
}
