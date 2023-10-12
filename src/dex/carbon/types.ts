import { ChainCache } from './sdk/chain-cache';
import { Action, MatchActionBNStr, TradeActionBNStr } from './sdk';

export type PoolState = {
  sdkCache: ChainCache;
};

export type CarbonData = {
  tradeDataMap: {
    [amount: string]: {
      tradeActions: TradeActionBNStr[];
      actionsTokenRes: Action[];
      totalSourceAmount: string;
      totalTargetAmount: string;
      effectiveRate: string;
      actionsWei: MatchActionBNStr[];
    };
  };
  decimals: { [token: string]: number };
};

export type DexParams = {
  subgraphURL: string;
  carbonController: string;
  voucher: string;
};
