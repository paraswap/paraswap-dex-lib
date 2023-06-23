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
      stateMulticall: '0x80898f80cFA3Fa3AbF410d90e69aDc432AE5D4c2',
      uniswapMulticall: '0xac1cE734566f390A94b00eb9bf561c2625BF44ea',
      chunksCount: 10,
      initHash:
        '0x6ce8eb472fa82df5469c6ab6d485f17c3ad13c8cd7af59b3d4a8026c5ce0f7e2',
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
