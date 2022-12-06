import _ from 'lodash';
import { LogDescription } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { IDexHelper } from '../../dex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Log, BlockHeader, Token, Address } from '../../types';
import { erc20Iface } from '../utils-interfaces';
import {
  decodeERC20Transfer,
  decodeWrappedDeposit,
  decodeWrappedWithdrawal,
} from './utils';
import { BalanceRequest, getBalances } from '../tokens/balancer-fetcher';
import {
  AssetType,
  DEFAULT_ID_ERC20,
  DEFAULT_ID_ERC20_AS_STRING,
} from '../tokens/types';
import { ERC20Event, ERC20StateMap, WrappedEvent } from './types';

export const handleTransferEvent = (
  event: LogDescription,
  state: ERC20StateMap,
) => {
  const erc20Transfer = decodeERC20Transfer(event);

  if (erc20Transfer.from in state) {
    state = _.cloneDeep(state);
    state[erc20Transfer.from].balance -= erc20Transfer.value;
  }

  if (erc20Transfer.to in state) {
    state = _.cloneDeep(state);
    state[erc20Transfer.to].balance += erc20Transfer.value;
  }

  return state;
};

export const handleWrappedDeposit = (
  event: LogDescription,
  state: ERC20StateMap,
) => {
  const deposit = decodeWrappedDeposit(event);

  if (deposit.dst in state) {
    state = _.cloneDeep(state);
    state[deposit.dst].balance += deposit.wad;
  }

  return state;
};

export const handleWrappedWithdrawal = (
  event: LogDescription,
  state: ERC20StateMap,
) => {
  const deposit = decodeWrappedWithdrawal(event);

  if (deposit.src in state) {
    state = _.cloneDeep(state);
    state[deposit.src].balance -= deposit.wad;
  }

  return state;
};

export class ERC20EventSubscriber extends StatefulEventSubscriber<ERC20StateMap> {
  private walletAddresses: Set<string> = new Set<string>();

  private handlers: {
    [event: string]: (
      event: LogDescription,
      pool: ERC20StateMap,
    ) => ERC20StateMap;
  } = {};

  constructor(readonly dexHelper: IDexHelper, private token: Address) {
    super(
      `ERC20Tracker`,
      token,
      dexHelper,
      dexHelper.getLogger(`${token}-${dexHelper.config.data.network}`),
    );
    this.token = token.toLowerCase();
    this.addressesSubscribed = [this.token];

    this.handlers[ERC20Event.Transfer] = handleTransferEvent;
    this.handlers[WrappedEvent.Deposit] = handleWrappedDeposit;
    this.handlers[WrappedEvent.Withdrawal] = handleWrappedWithdrawal;
  }

  protected async processBlockLogs(
    state: DeepReadonly<ERC20StateMap>,
    logs: Readonly<Log>[],
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<ERC20StateMap> | null> {
    let newState = await super.processBlockLogs(state, logs, blockHeader);
    if (!newState) {
      let newState = await this.generateState(blockHeader.number);
    }

    return newState;
  }

  protected processLog(
    state: DeepReadonly<ERC20StateMap>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<ERC20StateMap> | null {
    const event = erc20Iface.parseLog(log);

    if (event.name in this.handlers) {
      return this.handlers[event.name](event, state);
    }

    return null;
  }

  private async getBalanceRPC(wallet: string, blockNumber: number) {
    const balances = await getBalances(
      this.dexHelper.multiWrapper,
      [
        {
          owner: wallet,
          asset: this.token,
          assetType: AssetType.ERC20,
          ids: [
            {
              id: DEFAULT_ID_ERC20,
              spenders: [],
            },
          ],
        },
      ],
      blockNumber,
    );

    return balances[0];
  }

  async subscribeToWalletBalanceChange(
    wallet: Address,
    blockNumber: number,
  ): Promise<void> {
    if (this.walletAddresses.has(wallet)) {
      return;
    }
    this.walletAddresses.add(wallet);

    let state = this.getState(blockNumber) as ERC20StateMap;
    if (state === null) {
      state = {} as ERC20StateMap;
    }

    const balance = await this.getBalanceRPC(wallet, blockNumber);

    state[wallet] = {
      balance: balance.amounts[DEFAULT_ID_ERC20_AS_STRING],
    };

    this.setState(state, blockNumber);
  }

  async generateState(blockNumber: number): Promise<Readonly<ERC20StateMap>> {
    const request = Array.from(this.walletAddresses).reduce((acc, wallet) => {
      acc.push({
        owner: wallet,
        asset: this.token,
        assetType: AssetType.ERC20,
        ids: [
          {
            id: DEFAULT_ID_ERC20,
            spenders: [],
          },
        ],
      });

      return acc;
    }, [] as BalanceRequest[]);

    const balances = await getBalances(
      this.dexHelper.multiWrapper,
      request,
      blockNumber,
    );
    balances.reduce((acc, balance) => {
      acc[balance.owner] = {
        balance: balance.amounts[DEFAULT_ID_ERC20_AS_STRING],
      };
      return acc;
    }, {} as ERC20StateMap);
    return {};
  }

  async getBalance(wallet: Address, blockNumber: number): Promise<bigint> {
    const state = this.getState(blockNumber) as ERC20StateMap;

    if (state === null) {
      throw new Error(`State is null`);
    }

    if (!(wallet in state)) {
      this.logger.warn(
        `Missing wallet ${wallet} for ${this.token} fallinging back to rpc`,
      );
      const balance = await this.getBalanceRPC(wallet, blockNumber);

      // this is ok because we don't modify readonly data
      state[wallet] = {
        balance: balance.amounts[DEFAULT_ID_ERC20_AS_STRING],
      };
    }

    return state[wallet].balance;
  }
}
