import { LogDescription } from '@ethersproject/abi';
import {
  ERC20Approval,
  ERC20Transfer,
  WrappedDeposit,
  WrappedWithdrawal,
} from './types';

export const decodeERC20Transfer = (
  decoded: LogDescription,
): ERC20Transfer => ({
  from: decoded.args[0].toLowerCase(),
  to: decoded.args[1].toLowerCase(),
  value: decoded.args[2].toBigInt(),
});

export const decodeERC20Approval = (
  decoded: LogDescription,
): ERC20Approval => ({
  owner: decoded.args[0].toLowerCase(),
  spender: decoded.args[1].toLowerCase(),
  value: decoded.args[2].toBigInt(),
});

export const decodeWrappedDeposit = (
  decoded: LogDescription,
): WrappedDeposit => ({
  dst: decoded.args[0].toLowerCase(),
  wad: decoded.args[1].toBigInt(),
});

export const decodeWrappedWithdrawal = (
  decoded: LogDescription,
): WrappedWithdrawal => ({
  src: decoded.args[0].toLowerCase(),
  wad: decoded.args[1].toBigInt(),
});
