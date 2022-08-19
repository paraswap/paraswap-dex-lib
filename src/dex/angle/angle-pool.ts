import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AngleData, DexParams, PoolState, CollateralMap } from './types';
import { AngleConfig } from './config';
import { Contract } from 'web3-eth-contract';
import abiPoolManager from '../../abi/angle/pool-manager.json';
import abiStableMaster from '../../abi/angle/stablemaster.json';
import abiPerpetualManager from '../../abi/angle/perpetual-manager.json';

const interfaces = {
  poolmanager: new Interface(abiPoolManager),
  stablemaster: new Interface(abiStableMaster),
  perpetualmanager: new Interface(abiPerpetualManager),
  oracle: new Interface([
    'function read() external view returns (uint256 rate)',
    'function readLower() external view returns (uint256 rate)',
    'function readUpper() external view returns (uint256 rate)',
  ]),
};

/*
Events to track
- Chainlink oracle update
get oracle.circuitChainlink(0).aggregator()
check for event AnswerUpdated

- totalHedgeAmount update
PerpetualOpened
PerpetualClosed
PerpetualsForceClosed

if perpetual is liquidated: no event? except KeeperTransferred

- stocksuser update
StocksUsersUpdated
MintedStablecoins
BurntStablecoins

- collateral ratio update
depends on `stocksusers` and oracle rate
*/

export class AngleEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      pool: DeepReadonly<PoolState>,
      log: Log,
    ) => DeepReadonly<PoolState>;
  } = {};

  addressesSubscribed: string[];

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public stableMasterAddress: string,
    public poolManagerAddress: string,
  ) {
    super(parentName, logger);

    this.addressesSubscribed = [stableMasterAddress, poolManagerAddress];

    this.handlers['myEvent'] = this.handleMyEvent.bind(this);
  }

  logDecoder(log: Log): any {
    // this.angleIface.parseLog(log);
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
      return state;
    } catch (e) {
      this.logger.error(
        `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
        e,
      );
      return null;
    }
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    return { pools: {} };
  }

  // Its just a dummy example
  handleMyEvent(event: any, pool: DeepReadonly<PoolState>, log: Log) {
    return pool;
  }
}
