import { Address } from '../../types';

export type ERC20State = {
  balance: bigint;
};

export type ERC20StateMap = Record<Address, ERC20State>;

export enum ERC20Event {
  Transfer = 'Transfer',
  Approval = 'Approval',
}

export type ERC20Transfer = {
  from: string;
  to: string;
  value: bigint;
};

export type ERC20Approval = {
  owner: string;
  spender: string;
  value: bigint;
};

export enum WrappedEvent {
  Transfer = 'Transfer',
  Approval = 'Approval',
  Deposit = 'Deposit',
  Withdrawal = 'Withdrawal',
}

export type WrappedDeposit = {
  dst: string;
  wad: bigint;
};

export type WrappedWithdrawal = {
  src: string;
  wad: bigint;
};
