import { DexParams, TokenType } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AngleConfig: DexConfigMap<DexParams> = {
  Angle: {
    [Network.MAINNET]: {
      agEUR: {
        address: '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8'.toLowerCase(),
        decimals: 18,
        stableMaster:
          '0x5adDc89785D75C86aB939E9e15bfBBb7Fc086A87'.toLowerCase(),
        collaterals: {
          USDC: {
            symbol: 'USDC',
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
            decimals: 6,
            poolManager:
              '0xe9f183FC656656f1F17af1F2b0dF79b8fF9ad8eD'.toLowerCase(),
            type: TokenType.Collateral,
          },
          DAI: {
            symbol: 'DAI',
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(),
            decimals: 18,
            poolManager:
              '0xc9daabC677F3d1301006e723bD21C60be57a5915'.toLowerCase(),
            type: TokenType.Collateral,
          },
          FRAX: {
            symbol: 'FRAX',
            address: '0x853d955aCEf822Db058eb8505911ED77F175b99e'.toLowerCase(),
            decimals: 18,
            poolManager:
              '0x6b4eE7352406707003bC6f6b96595FD35925af48'.toLowerCase(),
            type: TokenType.Collateral,
          },
          WETH: {
            symbol: 'WETH',
            address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
            decimals: 18,
            poolManager:
              '0x3f66867b4b6eCeBA0dBb6776be15619F73BC30A2'.toLowerCase(),
            type: TokenType.Collateral,
          },
        },
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
