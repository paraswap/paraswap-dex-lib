import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const UnshEthConfig: DexConfigMap<DexParams> = {
  UnshEth: {
    [Network.MAINNET]: {
      supportedTokens: [
        '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', // cbETH
        '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // wstETH
        '0xac3E018457B222d93114458476f3E3416Abbe38F', // sfrxETH
        '0xae78736Cd615f374D3085123A210448E74Fc6393', // rETH
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0x0Ae38f7E10A43B5b2fB064B42a2f4514cbA909ef', // unshETH
      ],
      lsdVaultAddress: '0x51A80238B5738725128d3a3e06Ab41c1d4C05C74',
      vdAmmAddress: '0x35636b85b68c1b4a216110fb3a5fb447a99db14a',
      unshETHZapAddress: '0x9d14855cc4c89d4647bc39bc9cfe458ce46c1a36',
      unshETHAddress: '0x0Ae38f7E10A43B5b2fB064B42a2f4514cbA909ef',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: { [SwapSide.SELL]: [] },
};
