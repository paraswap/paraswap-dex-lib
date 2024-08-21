import { BigNumber } from 'ethers';
import { Interface } from '@ethersproject/abi';
import { LogDescription } from 'ethers/lib/utils';
import { IDexHelper } from '../../dex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, BlockHeader, Log, Logger } from '../../types';
import { TokenState } from './types';
import { Network } from '../../constants';

export type OnTransferCallback = (
  token: Address,
  from: Address,
  to: Address,
  amount: bigint,
  blockNumber: number,
) => Promise<void>;

export class IntegralToken extends StatefulEventSubscriber<TokenState> {
  handlers: {
    [event: string]: (
      event: any,
      state: TokenState,
      blockHeader: Readonly<BlockHeader>,
    ) => Promise<TokenState>;
  } = {};

  logDecoder: (log: Log) => any;

  constructor(
    readonly network: Network,
    readonly dexHelper: IDexHelper,
    parentName: string,
    protected readonly erc20Interface: Interface,
    readonly tokenAddress: Address,
    readonly relayerAddress: Address,
    protected readonly onTransfer: OnTransferCallback,
    logger: Logger,
    mapKey: string = '',
  ) {
    super(parentName, `ERC20 Token`, dexHelper, logger, true, mapKey);
    this.addressesSubscribed = [tokenAddress];
    this.logDecoder = (log: Log) => {
      let ret;
      try {
        ret = this.erc20Interface.parseLog(log);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.startsWith('no matching event')) {
            // ignore custom events for some tokens
            return null;
          }
        }
        throw error;
      }
      return ret;
    };
    this.handlers['Transfer'] = this.handleTransfer.bind(this);
  }

  async generateState(): Promise<TokenState> {
    return {};
  }

  protected getPoolIdentifierData() {
    return { token: this.tokenAddress };
  }

  protected async processLog(
    state: TokenState,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<TokenState> {
    const event = this.logDecoder(log);
    if (event && event.name in this.handlers) {
      await this.handlers[event.name](event, state, blockHeader);
    }
    return state;
  }

  async handleTransfer(
    event: LogDescription,
    state: TokenState,
    _blockHeader: Readonly<BlockHeader>,
  ) {
    const from = event.args[0].toLowerCase();
    const to = event.args[1].toLowerCase();
    if (from === this.relayerAddress || to === this.relayerAddress) {
      const amount = BigNumber.from(event.args[2]).toBigInt();
      await this.onTransfer(
        this.tokenAddress,
        from,
        to,
        amount,
        _blockHeader.number,
      );
    }
    return state;
  }
}
