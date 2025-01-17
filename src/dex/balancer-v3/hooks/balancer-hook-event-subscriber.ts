import { Fragment, Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../../types';
import { catchParseLogError } from '../../../utils';
import { StatefulEventSubscriber } from '../../../stateful-event-subscriber';
import { IDexHelper } from '../../../dex-helper/idex-helper';
import { loadHooksConfig } from './loadHooksConfig';
import {
  DirectionalFeeHookState,
  directionalFeeType,
  exitFeeHookExampleRegisteredEvent,
  getDirectionalFeeHookState,
} from './directionalFeeHook';
import exitFeeHookAbi from '../../../abi/balancer-v3/directionalFeeHook.json';

// Add each supported hook state here
export type HookState = DirectionalFeeHookState;

export type HookStateMap = {
  [address: string]: HookState;
};

export type HooksTypeMap = {
  [hookAddress: string]: string; // hookAddress -> hookType mapping
};

/**
 * This will handle events/state for each supported hook contract. State is used during swap calculations.
 * Each hook should have its own implementation file for state typing, fetching state and handling events.
 */
export class BalancerEventHook extends StatefulEventSubscriber<HookStateMap> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<HookStateMap>,
      log: Readonly<Log>,
    ) => DeepReadonly<HookStateMap> | null;
  } = {};

  interfaces: Interface[];
  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  hooksTypeMap: HooksTypeMap;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(parentName, 'Balancer_Hooks', dexHelper, logger);

    // Load supported hooks from config file
    this.hooksTypeMap = loadHooksConfig(network);

    // Add each hook ABI here
    this.interfaces = [new Interface(exitFeeHookAbi)];
    // Add any hook specific log decoders here (see balancer-v3-pool as ref when doing first hook implementation)
    this.logDecoder = (log: Log) =>
      this.combineInterfaces(this.interfaces).parseLog(log);

    // Subscribe to all hooks
    this.addressesSubscribed = Object.keys(this.hooksTypeMap);

    // Add hook specific log handlers here
    this.handlers['ExitFeeHookExampleRegistered'] =
      exitFeeHookExampleRegisteredEvent.bind(this);
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
    state: DeepReadonly<HookStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<HookStateMap> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
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
  async generateState(
    blockNumber: number,
  ): Promise<DeepReadonly<HookStateMap>> {
    // Only hooks that are supported will be called
    const hookState: HookStateMap = {};
    for (const hookAddress in this.hooksTypeMap) {
      const hookType = this.hooksTypeMap[hookAddress];
      if (hookType === directionalFeeType) {
        hookState[hookAddress] = await getDirectionalFeeHookState();
      }
    }
    return hookState;
  }

  combineInterfaces = (interfaces: Interface[]): Interface => {
    const allFragments: Fragment[] = interfaces.reduce(
      (acc: Fragment[], interfaceInstance: Interface) => {
        // Get all fragments from the current interface
        const fragments = interfaceInstance.fragments;
        return [...acc, ...fragments];
      },
      [],
    );

    // Create a new interface with all fragments
    return new Interface(allFragments);
  };
}
