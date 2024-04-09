import { Interface } from '@ethersproject/abi';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { catchParseLogError, normalizeAddress, stringify } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper';
import { FactoryState, OnPoolCreatedCallback } from './types';
import vPairFactoryABI from '../../abi/virtuswap/vPairFactory.json';
import { abiCoderParsers } from './utils';

export class VirtuSwapFactory extends StatefulEventSubscriber<FactoryState> {
  static readonly vPairFactoryInterface = new Interface(vPairFactoryABI);
  static readonly contractPairsLengthParser = abiCoderParsers.Int.create(
    'allPairsLength',
    'uint256',
  );
  static readonly contractAllPairsParser = abiCoderParsers.Address.create(
    'allPairs',
    'address',
  );

  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<FactoryState>,
      log: Readonly<Log>,
    ) => AsyncOrSync<DeepReadonly<FactoryState> | null>;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected onPoolCreatedCallback: OnPoolCreatedCallback,
    protected factoryAddress: Address,
    protected vPairFactoryIface: Interface = VirtuSwapFactory.vPairFactoryInterface,
  ) {
    super(
      parentName,
      `${parentName}_${network}_factory_${factoryAddress}`,
      dexHelper,
      logger,
      true,
    );

    this.logDecoder = (log: Log) => this.vPairFactoryIface.parseLog(log);
    this.addressesSubscribed = [factoryAddress];

    this.handlers['PairCreated'] = this.handlePairCreated.bind(this); // 0x70084adbff44be952e8bb87558f46235532635d476e79e29558665fa7d6c12ce
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
  protected async processLog(
    state: DeepReadonly<FactoryState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<FactoryState> | null> {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return await this.handlers[event.name](event, state, log);
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
   * @param blockNumber - Blocknumber for which the state
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(
    blockNumber: number,
  ): Promise<DeepReadonly<FactoryState>> {
    // Get allPairsLength
    const lengthMultiCallParams = [
      VirtuSwapFactory.contractPairsLengthParser,
    ].map(
      ({ name, decodeFunction }) =>
        ({
          target: this.factoryAddress,
          callData: this.vPairFactoryIface.encodeFunctionData(name),
          decodeFunction,
        } as MultiCallParams<ReturnType<typeof decodeFunction>>),
    );

    const [allPairsLength] = await this.dexHelper.multiWrapper.aggregate(
      lengthMultiCallParams,
      blockNumber,
    );

    // Get all pairs (addresses of pools)
    const allPairsMultiCallParams = Array.from(
      { length: allPairsLength },
      (_, i) =>
        ({
          target: this.factoryAddress,
          callData: this.vPairFactoryIface.encodeFunctionData('allPairs', [i]),
          decodeFunction:
            VirtuSwapFactory.contractAllPairsParser.decodeFunction,
        } as MultiCallParams<Address>),
    );

    const pools = await this.dexHelper.multiWrapper.aggregate(
      allPairsMultiCallParams,
      blockNumber,
    );

    await Promise.all(
      pools.map(pool => this.onPoolCreatedCallback(pool, blockNumber)),
    );

    return {
      pools,
    };
  }

  async handlePairCreated(
    event: any,
    state: DeepReadonly<FactoryState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<FactoryState> | null> {
    const pool = normalizeAddress(stringify(event.args.poolAddress));

    await this.onPoolCreatedCallback(pool, log.blockNumber);

    return {
      ...state,
      pools: [...state.pools, pool],
    };
  }
}
