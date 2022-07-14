import { DeepReadonly } from 'ts-essentials';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { lens } from '../../lens';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { IbAmmPoolState, IbTokensInfo } from './types';

export class IbAmmPool extends ComposedEventSubscriber<IbAmmPoolState> {
  constructor(
    dexKey: string,
    network: number,
    name: string,
    ibTokensInfo: IbTokensInfo[],
    dexHelper: IDexHelper,
  ) {
    super(
      `${dexKey} ${name}`,
      dexHelper.getLogger(`${dexKey}-${network} ${name}`),
      dexHelper,
      ibTokensInfo.map(
        p =>
          new ChainLinkSubscriber<IbAmmPoolState>(
            p.FEED_ADDRESS,
            p.AGGREGATOR_ADDRESS,
            lens<DeepReadonly<IbAmmPoolState>>().chainlink[p.TOKEN_ADDRESS],
            dexHelper.getLogger(
              `${p.TOKEN_SYMBOL} ChainLink for ${dexKey}-${network} ${name}`,
            ),
          ),
      ),
      {
        chainlink: {},
      },
    );
  }
}
