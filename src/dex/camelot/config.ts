import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const CamelotConfig: DexConfigMap<DexParams> = {
  Camelot: {
    [Network.ARBITRUM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/camelotlabs/camelot-amm-2',
      factoryAddress: '0x6EcCab422D763aC031210895C81787E87B43A652',
      router: '0x1Be46c7A40906c19d91d07B3AE69Ef5893268F25',
      initCode:
        '0xa856464ae65f7619087bc369daaf7e387dae1e5af69cfa7935850ebf754b04c1',
      feeCode: 0, // this is ignored as Camelot uses dynamic fees
      poolGasCost: 180 * 1000,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter02', index: 1 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 1 }],
  },
};
