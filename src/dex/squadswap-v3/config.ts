import { DexParams } from '../uniswap-v3/types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const SQUAD_SUPPORTED_FEES = [10000n, 2500n, 500n, 100n];

export const SquadswapV3Config: DexConfigMap<DexParams> = {
  SquadswapV3: {
    [Network.BSC]: {
      factory: '0x009c4ef7C0e0Dd6bd1ea28417c01Ea16341367c3',
      deployer: '0x38e09D9444B41CFda398DD31eb2713Ca5c3B75eA',
      quoter: '0x81Da0D4e1157391a22a656ad84AAb9b2716F21e0',
      router: '0xAf4b332ddBa499B6116235a095CEE2f2030BCBC0',
      supportedFees: SQUAD_SUPPORTED_FEES,
      stateMulticall: '0x9DAd2ED7ADc6eaacf81589Cd043579c9684E5C81',
      uniswapMulticall: '0xac1cE734566f390A94b00eb9bf561c2625BF44ea',
      chunksCount: 10,
      initRetryFrequency: 30,
      initHash:
        '0xf08a35894b6b71b07d95a23022375630f6cee63a27d724c703617c17c4fc387d',
      subgraphURL:
        'https://api.studio.thegraph.com/query/59394/test-pcs-uni/v0.0.8',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 4 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 5 }],
  },
};
