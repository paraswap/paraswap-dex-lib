import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SynthetixConfig: DexConfigMap<DexParams> = {
  Synthetix: {
    [Network.MAINNET]: {
      readProxyAddressResolver: '0x4E3b31eB0E5CB73641EE1E65E7dCEFe520bA3ef2',
      flexibleStorage: '0xc757aCBa3c0506218b3022266a9DC7F3612d85f5',
      synths: [
        '0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb', // sETH
        '0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6', // sBTC
        '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51', // sUSD
        '0xD71eCFF9342A5Ced620049e616c5035F1dB98620', // sEUR
        '0x0F83287FF768D1c1e17a42F44d644D7F22e8ee1d', // sCHF
        '0xF6b1C627e95BFc3c1b4c9B825a032Ff0fBf3e07d', // sJPY
        '0x97fe22E7341a0Cd8Db6F6C021A24Dc8f4DAD855F', // sGBP
        '0x269895a3dF4D73b077Fc823dD6dA1B95f72Aaf9B', // sKRW
        '0xfb020CA7f4e8C4a5bBBe060f59a249c6275d2b69', // sAUD
      ],
    },
    [Network.OPTIMISM]: {
      readProxyAddressResolver: '0x1Cb059b7e74fD21665968C908806143E744D5F30',
      flexibleStorage: '0x47649022380d182DA8010Ae5d257fea4227b21ff',
      synths: [
        '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4', // SNX
        '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9', // sUSD
        '0x00B8D5a5e1Ac97Cb4341c4Bc4367443c8776e8d9', // sAAVE
        '0xB2b42B231C68cbb0b4bF2FFEbf57782Fd97D3dA4', // sAVAX
        '0x298B9B95708152ff6968aafd889c6586e9169f1D', // sBTC
        '0xE405de8F52ba7559f9df3C368500B6E6ae6Cee49', // sBTC
        '0xFBc4198702E81aE77c06D58f81b629BDf36f0a71', // sEUR
        '0xa3A538EA5D5838dC32dde15946ccD74bDd5652fF', // sINR
        '0xc5Db22719A06418028A40A9B5E9A7c02959D0d08', // sLINK
        '0x81DDfAc111913d3d5218DEA999216323B7CD6356', // sMATIC
        '0x8b2F7Ae8cA8EE8428B6D76dE88326bB413db2766', // sSOL
        '0xf5a6115Aa582Fd1BEEa22BC93B7dC7a785F60d03', // sUNI
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
