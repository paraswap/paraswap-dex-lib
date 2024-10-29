import { Address, Token } from '../src/types';
export declare type StateOverride = {
    value: Record<string, string>;
};
export declare type StateSimulateApiOverride = {
    storage: {
        value: Record<string, string>;
    };
};
export declare type StateOverrides = {
    networkID: string;
    stateOverrides: Record<Address, StateOverride>;
};
export declare type AddBalanceFn = (address: Address, amount: string) => Record<string, string>;
export declare type AddAllowanceFn = (address: Address, spender: Address, amount: string) => Record<string, string>;
export declare const balanceOfFn: AddBalanceFn;
export declare const balancesFn: AddBalanceFn;
export declare const balanceAndBlacklistStatesFn: AddBalanceFn;
export declare const _balancesFn: AddBalanceFn;
export declare const allowanceFn: AddAllowanceFn;
export declare const _allowancesFn: AddAllowanceFn;
export declare const allowedFn: AddAllowanceFn;
export declare type SmartTokenParams = Token & {
    addBalance?: AddBalanceFn;
    addAllowance?: AddAllowanceFn;
};
export declare class SmartToken {
    private params;
    private value;
    constructor(params: SmartTokenParams);
    get address(): string;
    get token(): Token;
    addBalance(address: Address, amount: string): SmartToken;
    addAllowance(address: Address, spender: string, amount: string): SmartToken;
    applyOverrides(overrides: StateOverrides): void;
}
