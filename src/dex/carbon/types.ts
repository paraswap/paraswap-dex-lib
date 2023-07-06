import { ChainCache } from './sdk/chain-cache';
import { Action, MatchActionBNStr, TradeActionBNStr } from './sdk';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!

  sdkCache: ChainCache;
};

export type CarbonData = {
  // TODO: CarbonData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
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
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
  subgraphURL: string;
  carbonController: string;
  voucher: string;
};
