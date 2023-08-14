import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const RAMSES_SUPPORTED_FEES = [10000n, 2500n, 500n, 100n];

export const RamsesV2Config: DexConfigMap<DexParams> = {
  RamsesV2: {
    [Network.ARBITRUM]: {
      factory: '0xAA2cd7477c451E703f3B9Ba5663334914763edF8',
      deployer: '0xb3e423ab9cE6C03D98326A3A2a0D7D96b0829f22',
      quoter: '0xAA20EFF7ad2F523590dE6c04918DaAE0904E3b20',
      router: '0xAA23611badAFB62D37E7295A682D21960ac85A90',
      supportedFees: RAMSES_SUPPORTED_FEES,
      // stateMulticall: '0xaBB58098A7B5172A9b0B38a1925A522dbf0b4FC3',
      stateMulticall: '0x2A7A9478Aaff076f8A80c03e7d65BD7d8D01650d',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initHash:
        '0x1565b129f2d1790f12d45301b9b084335626f0c92410bc43130763b69971135d',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/ramsesexchange/concentrated-liquidity-graph',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 3 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 2 }],
  },
};
