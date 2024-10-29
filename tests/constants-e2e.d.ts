import { SmartTokenParams, SmartToken } from '../tests/smart-tokens';
import { Address } from '../src/types';
export declare const GIFTER_ADDRESS = "0xb22fC4eC94D555A5049593ca4552c810Fb8a6d00";
export declare const GENERIC_ADDR1 = "0xbe9317f6711e2da074fe1f168fd9c402bc0a9d1b";
export declare const GENERIC_ADDR2 = "0x230a1ac45690b9ae1176389434610b9526d2f21b";
export declare const Tokens: {
    [network: number]: {
        [symbol: string]: SmartTokenParams;
    };
};
export declare const Holders: {
    [network: number]: {
        [tokenAddress: string]: Address;
    };
};
export declare const SmartTokens: Record<number, Record<string, SmartToken>>;
export declare const NativeTokenSymbols: {
    [network: number]: string;
};
export declare const WrappedNativeTokenSymbols: {
    [network: number]: string;
};
