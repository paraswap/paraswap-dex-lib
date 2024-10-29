"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartToken = exports.allowedFn = exports._allowancesFn = exports.allowanceFn = exports._balancesFn = exports.balanceAndBlacklistStatesFn = exports.balancesFn = exports.balanceOfFn = void 0;
const constructAddBalanceFn = (varName) => {
    return (address, amount) => {
        return {
            [`${varName}[${address}]`]: amount,
        };
    };
};
const constructAddBAllowanceFn = (varName) => {
    return (address, spender, amount) => {
        return {
            [`${varName}[${address}][${spender}]`]: amount,
        };
    };
};
exports.balanceOfFn = constructAddBalanceFn('balanceOf');
exports.balancesFn = constructAddBalanceFn('balances');
exports.balanceAndBlacklistStatesFn = constructAddBalanceFn('balanceAndBlacklistStates');
exports._balancesFn = constructAddBalanceFn('_balances');
exports.allowanceFn = constructAddBAllowanceFn('allowance');
exports._allowancesFn = constructAddBAllowanceFn('_allowances');
exports.allowedFn = constructAddBAllowanceFn('allowed');
class SmartToken {
    constructor(params) {
        this.params = params;
        this.value = {};
        if (!params.addBalance) {
            throw new Error(`${params.address} ${params.symbol} needs to provide addBalance fn`);
        }
        if (!params.addAllowance) {
            throw new Error(`${params.address} ${params.symbol} needs to provide addAllowance fn`);
        }
    }
    get address() {
        return this.params.address;
    }
    get token() {
        return {
            address: this.params.address,
            decimals: this.params.decimals,
            symbol: this.params.symbol,
            type: this.params.type,
        };
    }
    addBalance(address, amount) {
        const [key, value] = Object.entries(this.params.addBalance(address, amount))[0];
        this.value[key] = value;
        return this;
    }
    addAllowance(address, spender, amount) {
        const [key, value] = Object.entries(this.params.addAllowance(address, spender, amount))[0];
        this.value[key] = value;
        return this;
    }
    applyOverrides(overrides) {
        overrides.stateOverrides[this.params.address] = {
            value: this.value,
        };
    }
}
exports.SmartToken = SmartToken;
//# sourceMappingURL=smart-tokens.js.map