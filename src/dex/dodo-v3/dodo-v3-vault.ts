import { Interface } from '@ethersproject/abi';
import { BytesLike, LogDescription } from 'ethers/lib/utils';
import { DeepReadonly, assert } from 'ts-essentials';
import D3VaultABI from '../../abi/dodo-v3/D3Vault.abi.json';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { generalDecoder } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, BlockHeader, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { D3VaultState } from './types';

export const addressArrayDecode = (
  result: MultiResult<BytesLike> | BytesLike,
): string[] => {
  return generalDecoder(result, ['address[]'], [], v =>
    v[0].map((a: string) => a.toLowerCase()),
  );
};

export type OnPoolCreatedOrRemovedCallback = ({
  pool,
  blockNumber,
}: {
  pool: string;
  blockNumber: number;
}) => Promise<void>;

/*
 * "Stateless" event subscriber in order to capture "PoolCreated" event on new pools created.
 * State is present, but it's a placeholder to actually make the events reach handlers (if there's no previous state - `processBlockLogs` is not called)
 */
export class DodoV3Vault extends StatefulEventSubscriber<D3VaultState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<D3VaultState>,
      blockHeader: Readonly<BlockHeader>,
    ) => DeepReadonly<D3VaultState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  readonly vaultAddress: Address;

  public readonly D3VaultIface = new Interface(D3VaultABI);

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    protected readonly D3VaultAddress: Address,
    logger: Logger,
    protected readonly onPoolCreated: OnPoolCreatedOrRemovedCallback,
    protected readonly onPoolRemoved: OnPoolCreatedOrRemovedCallback,
    mapKey: string = '',
  ) {
    super(parentName, `${parentName} D3Vault`, dexHelper, logger, true, mapKey);
    this.vaultAddress = D3VaultAddress;
    this.addressesSubscribed = [D3VaultAddress];

    this.logDecoder = (log: Log) => this.D3VaultIface.parseLog(log);

    this.handlers['AddPool'] = this.handleNewPool.bind(this);
    this.handlers['RemovePool'] = this.handleRemovePool.bind(this);

    this.handlers['AddToken'] = this.handleAddToken.bind(this);
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
  ): Promise<DeepReadonly<D3VaultState>> {
    const [resTokenList] = await this.dexHelper.multiWrapper.tryAggregate<
      Array<Address>
    >(
      false,
      [
        {
          target: this.vaultAddress,
          callData: this.D3VaultIface.encodeFunctionData('getTokenList', []),
          decodeFunction: addressArrayDecode,
        },
      ],
      blockNumber,
      this.dexHelper.multiWrapper.defaultBatchSize,
      false,
    );
    this.logger.info(`${this.vaultAddress} getTokenList`, resTokenList);

    assert(resTokenList.success, 'Failed to fetch token list');
    const tokenList = resTokenList.returnData;

    return {
      tokenList,
    };
  }

  protected processLog(
    state: DeepReadonly<D3VaultState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<D3VaultState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, blockHeader);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  handleNewPool(
    event: LogDescription,
    state: DeepReadonly<D3VaultState>,
    blockHeader: BlockHeader,
  ): DeepReadonly<D3VaultState> | null {
    const pool = event.args.pool.toLowerCase();

    this.onPoolCreated({ pool, blockNumber: blockHeader.number });
    return state;
  }

  handleRemovePool(
    event: LogDescription,
    state: DeepReadonly<D3VaultState>,
    blockHeader: BlockHeader,
  ): DeepReadonly<D3VaultState> | null {
    const pool = event.args.pool.toLowerCase();

    this.onPoolRemoved({ pool, blockNumber: blockHeader.number });
    return state;
  }

  handleAddToken(
    event: LogDescription,
    state: DeepReadonly<D3VaultState>,
    blockHeader: BlockHeader,
  ): DeepReadonly<D3VaultState> | null {
    const newToken = event.args.token.toLowerCase();

    if (state.tokenList.indexOf(newToken) === -1) {
      return {
        ...state,
        tokenList: [...state.tokenList, newToken],
      };
    }

    return state;
  }
}
