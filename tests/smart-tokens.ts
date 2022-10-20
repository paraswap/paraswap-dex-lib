import { Address, Token } from '../src/types';

export type StateOverride = {
  value: Record<string, string>;
};

export type StateSimulateApiOverride = {
  storage: {
    value: Record<string, string>;
  };
};

export type StateOverrides = {
  networkID: string;
  stateOverrides: Record<Address, StateOverride>;
};

export type AddBalanceFn = (
  address: Address,
  amount: string,
) => Record<string, string>;
export type AddAllowanceFn = (
  address: Address,
  spender: Address,
  amount: string,
) => Record<string, string>;

const constructAddBalanceFn = (varName: string): AddBalanceFn => {
  return (address: Address, amount: string) => {
    return {
      [`${varName}[${address}]`]: amount,
    };
  };
};

const constructAddBAllowanceFn = (varName: string): AddAllowanceFn => {
  return (address: Address, spender: string, amount: string) => {
    return {
      [`${varName}[${address}][${spender}]`]: amount,
    };
  };
};

export const balanceOfFn = constructAddBalanceFn('balanceOf');
export const allowanceFn = constructAddBAllowanceFn('allowance');

export type SmartTokenParams = Token & {
  addBalance?: AddBalanceFn;
  addAllowance?: AddAllowanceFn;
};

export class SmartToken {
  private value: Record<string, string> = {};

  constructor(private params: SmartTokenParams) {
    if (!params.addBalance) {
      throw new Error(
        `${params.address} ${params.symbol} needs to provide addBalance fn`,
      );
    }

    if (!params.addAllowance) {
      throw new Error(
        `${params.address} ${params.symbol} needs to provide addAllowance fn`,
      );
    }
  }

  get address() {
    return this.params.address;
  }

  get token(): Token {
    return {
      address: this.params.address,
      decimals: this.params.decimals,
      symbol: this.params.symbol,
      type: this.params.type,
    };
  }

  public addBalance(address: Address, amount: string): SmartToken {
    const [key, value] = Object.entries(
      this.params.addBalance!(address, amount),
    )[0];
    this.value[key] = value;
    return this;
  }

  public addAllowance(
    address: Address,
    spender: string,
    amount: string,
  ): SmartToken {
    const [key, value] = Object.entries(
      this.params.addAllowance!(address, spender, amount),
    )[0];
    this.value[key] = value;
    return this;
  }

  public applyOverrides(overrides: StateOverrides) {
    overrides.stateOverrides[this.params.address] = {
      value: this.value,
    };
  }
}
