import { Interface } from '@ethersproject/abi';
import { uint256ToBigInt } from '../../lib/decoders';
import CDO_ABI from '../../abi/idle-dao/idle-cdo.json';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, IdleToken, PoolsState } from './types';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import { pollingManagerCbExtractor } from '../../lib/stateful-rpc-poller/utils';
import { StatefulRpcPoller } from '../../lib/stateful-rpc-poller/stateful-rpc-poller';
import { StatePollingManager } from '../../lib/stateful-rpc-poller/state-polling-manager';
import { Logger } from '../../types';
import { ObjWithUpdateInfo } from '../../lib/stateful-rpc-poller/types';

type MulticallResultOutputs = bigint;

export class IdleDaoPollingPool extends StatefulRpcPoller<
  PoolsState,
  MulticallResultOutputs
> {
  constructor(
    dexKey: string,
    poolIdentifier: string,
    dexHelper: IDexHelper,
    protected idleTokens: IdleToken[],
    protected logger: Logger,
  ) {
    const callbacks = pollingManagerCbExtractor(
      StatePollingManager.getInstance(dexHelper),
    );

    super(dexKey, poolIdentifier, dexHelper, 0, 0, false, callbacks);
  }

  async getAggregatedBlockData(
    blockNumber: number,
  ): Promise<ObjWithUpdateInfo<PoolsState> | null> {
    const multiCalls = this.getFetchStateWithBlockInfoMultiCalls();
    try {
      const lastUpdatedAtMs = Date.now();
      const aggregatedResults = (await this.dexHelper.multiWrapper.tryAggregate<
        number | MulticallResultOutputs
      >(
        true,
        multiCalls as MultiCallParams<MulticallResultOutputs | number>[],
        blockNumber,
      )) as [MultiResult<number>, ...MultiResult<MulticallResultOutputs>[]];

      return this.parseStateFromMultiResultsWithBlockInfo(
        aggregatedResults,
        lastUpdatedAtMs,
      );
    } catch (e) {
      // this.logger.debug('ERROR fetching multicall data', blockNumber, e)
    }

    return null;
  }

  protected _getFetchStateMultiCalls(): MultiCallParams<MulticallResultOutputs>[] {
    const cdoInterface = new Interface(CDO_ABI);
    return this.idleTokens.map(idleToken => ({
      target: idleToken.cdoAddress,
      callData: cdoInterface.encodeFunctionData('virtualPrice', [
        idleToken.idleAddress,
      ]),
      decodeFunction: uint256ToBigInt,
    })) as MultiCallParams<MulticallResultOutputs>[];
  }

  protected _parseStateFromMultiResults(
    multiOutputs: MulticallResultOutputs[],
  ): PoolsState {
    const output: PoolsState = multiOutputs.reduce(
      (acc: PoolsState, output: MulticallResultOutputs, index: number) => {
        const tokenPrice = output as bigint;
        const idleToken = this.idleTokens[index];
        return {
          ...acc,
          [idleToken.idleAddress]: {
            tokenPrice,
          },
        };
      },
      {},
    );
    return output;
  }
}
