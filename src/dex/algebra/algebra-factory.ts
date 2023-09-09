import { Interface } from '@ethersproject/abi';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import FactoryABI from '../../abi/algebra/AlgebraFactory-v1_1.abi.json';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, Log, Logger } from '../../types';

export type OnPoolCreatedCallback = ({
  token0,
  token1,
}: {
  token0: string;
  token1: string;
}) => AsyncOrSync<void>;

/*
 * Stateless event subscriber in order to capture "Pool" event on new pools created.
 */
export class AlgebraFactory extends StatefulEventSubscriber<void> {
  handlers: {
    [event: string]: (event: any) => DeepReadonly<void> | null;
  } = {};

  logDecoder: (log: Log) => any;

  public readonly factoryIface = new Interface(FactoryABI);

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    protected readonly factoryAddress: Address,
    logger: Logger,
    protected readonly onPoolCreated: OnPoolCreatedCallback,
    mapKey: string = '',
  ) {
    super(parentName, `factory`, dexHelper, logger, true, mapKey);

    this.addressesSubscribed = [factoryAddress];

    this.logDecoder = (log: Log) => this.factoryIface.parseLog(log);

    this.handlers['Pool'] = this.handleNewPool.bind(this);
  }

  generateState(): AsyncOrSync<void> {}

  protected processLog(
    _: DeepReadonly<void>,
    log: Readonly<Log>,
  ): DeepReadonly<void> | null {
    const event = this.logDecoder(log);
    if (event.name in this.handlers) {
      this.handlers[event.name](event);
    }

    return null;
  }

  handleNewPool(event: any) {
    const token0 = event.args.token0;
    const token1 = event.args.token1;

    this.onPoolCreated({ token0, token1 });
  }
}
