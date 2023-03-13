import { Interface } from '@ethersproject/abi';
import { Log, Logger } from '../../types';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MulticallResultOutputs, PoolState } from './types';
import { NULL_STATE } from './constants';
import { StatefulRpcPoller } from '../../lib/stateful-rpc-poller/stateful-rpc-poller';
import { pollingManagerCbExtractor } from '../../lib/stateful-rpc-poller/utils';
import { StatePollingManager } from '../../lib/stateful-rpc-poller/state-polling-manager';
import { MultiCallParams } from '../../lib/multi-wrapper';

export class WooFiV2PollingPool extends StatefulRpcPoller<
  PoolState,
  MulticallResultOutputs
> {
  constructor(dexKey: string, poolIdentifier: string, dexHelper: IDexHelper) {
    const callbacks = pollingManagerCbExtractor(
      StatePollingManager.getInstance(dexHelper),
    );

    super(dexKey, poolIdentifier, dexHelper, 0, 0, false, callbacks);
  }

  protected _getFetchStateMultiCalls(): MultiCallParams<MulticallResultOutputs>[] {
    return [];
  }

  protected _parseStateFromMultiResults(multiOutputs: number[]): PoolState {
    return NULL_STATE;
  }
}
