import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { DexParams } from './types';

export const UniswapV4Config: DexConfigMap<DexParams> = {
  UniswapV4: {
    [Network.BASE]: {
      poolManager: '0x498581ff718922c3f8e6a244956af099b2652b2b',
      subgraphURL: 'HNCFA9TyBqpo5qpe6QreQABAA1kV8g46mhkCcicu6v2R',
      quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
      router: '0x6ff5693b99212da76ad316178a184ab56d299b43',
    },
  },
};
