import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MiroMigratorState } from './types';
import { uint256ToBigInt } from '../../lib/decoders';

export class MiroMigratorEventState extends StatefulEventSubscriber<MiroMigratorState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<MiroMigratorState>,
      log: Readonly<Log>,
    ) => DeepReadonly<MiroMigratorState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected migratorInterface: Interface,
    protected migratorAddress: string,
    protected xyzInterface: Interface,
    protected xyzAddress: string,
    protected transferTopic: string,
  ) {
    super(parentName, 'miro_migrator_state', dexHelper, logger);
    this.logDecoder = (log: Log) => this.migratorInterface.parseLog(log);
    this.addressesSubscribed = [xyzAddress];
  }

  protected async processLog(
    state: DeepReadonly<MiroMigratorState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<MiroMigratorState> | null> {
    try {
      const event = this.logDecoder(log);

      if (
        log.topics[0] === this.transferTopic &&
        event.args.to.toLowerCase() === this.migratorAddress.toLowerCase()
      ) {
        return this.handleTransferTo(event, state, log);
      }

      if (
        log.topics[0] === this.transferTopic &&
        event.args.from.toLowerCase() === this.migratorAddress.toLowerCase()
      ) {
        return this.handleTransferFrom(event, state, log);
      }

      return null;
    } catch (e) {
      catchParseLogError(e, this.logger);
      return null;
    }
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<MiroMigratorState>> {
    const calls = [
      {
        target: this.xyzAddress,
        callData: this.xyzInterface.encodeFunctionData('balanceOf', [
          this.migratorAddress,
        ]),
        decodeFunction: uint256ToBigInt,
      },
    ];

    const [balance] = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
      true,
      calls,
      blockNumber,
    );

    return { balance: balance.returnData };
  }

  async getOrGenerateState(blockNumber: number): Promise<MiroMigratorState> {
    let state = this.getState(blockNumber);
    if (!state) {
      state = await this.generateState(blockNumber);
      this.setState(state, blockNumber);
    }
    return state;
  }

  async handleTransferTo(
    event: any,
    state: DeepReadonly<MiroMigratorState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<MiroMigratorState>> {
    return {
      balance: state.balance + BigInt(event.args.value),
    };
  }

  async handleTransferFrom(
    event: any,
    state: DeepReadonly<MiroMigratorState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<MiroMigratorState>> {
    return {
      balance: state.balance - BigInt(event.args.value),
    };
  }
}
