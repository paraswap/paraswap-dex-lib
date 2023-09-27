import { Interface } from '@ethersproject/abi';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import FactoryABI from '../../abi/uniswap-v3/UniswapV3Factory.abi.json';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, Log, Logger } from '../../types';
import { LogDescription } from 'ethers/lib/utils';

export type OnPoolCreatedCallback = ({
  token0,
  token1,
  fee,
}: {
  token0: string;
  token1: string;
  fee: bigint;
}) => AsyncOrSync<void>;

/*
 * Stateless event subscriber in order to capture "Pool" event on new pools created.
 */
export class UniswapV3Factory extends StatefulEventSubscriber<void> {
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

    this.handlers['PoolCreated'] = this.handleNewPool.bind(this);
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

  handleNewPool(event: LogDescription) {
    const token0 = event.args.token0;
    const token1 = event.args.token1;
    const fee = event.args.fee;

    this.onPoolCreated({ token0, token1, fee });
  }
}
