import { IbAmmInfo } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const IbAmmConfig: DexConfigMap<IbAmmInfo> = {
  IbAmm: {
    [Network.MAINNET]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      MIM: '0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3',
      IBAMM_ADDRESS: '0x0a0B06322825cb979678C722BA9932E0e4B5fd90',
      IB_TOKENS: [
        {
          AGGREGATOR_ADDRESS: '0x7f7b323291c052de18926396176d384c4a8e19e2', // AUD/USD
          FEED_ADDRESS: '0x77F9710E7d0A19669A13c055F62cd80d313dF022', // AUD/USD
          FEED_DECIMALS: 8,
          TOKEN_ADDRESS: '0xFAFdF0C4c1CB09d430Bf88c75D88BB46DAe09967', // ibAUD
          TOKEN_SYMBOL: 'IBAUD',
        },
        {
          AGGREGATOR_ADDRESS: '0x7c8719f3683585a242a67c73f6f3c98362004da4', // CHF/USD
          FEED_ADDRESS: '0x449d117117838fFA61263B61dA6301AA2a88B13A', // CHF/USD
          FEED_DECIMALS: 8,
          TOKEN_ADDRESS: '0x1CC481cE2BD2EC7Bf67d1Be64d4878b16078F309', // ibCHF
          TOKEN_SYMBOL: 'IBCHF',
        },
        {
          AGGREGATOR_ADDRESS: '0x568b8fd03992f56bf240958d22f5a6fcf7bd850b', // GBP/USD
          FEED_ADDRESS: '0x5c0ab2d9b5a7ed9f470386e82bb36a3613cdd4b5', // GBP/USD
          FEED_DECIMALS: 8,
          TOKEN_ADDRESS: '0x69681f8fde45345C3870BCD5eaf4A05a60E7D227', // ibGBP
          TOKEN_SYMBOL: 'IBGBP',
        },
        {
          AGGREGATOR_ADDRESS: '0x01a1f73b1f4726eb6eb189ffa5cbb91af8e14025', // JPY/USD
          FEED_ADDRESS: '0xbce206cae7f0ec07b545edde332a47c2f75bbeb3', // JPY/USD
          FEED_DECIMALS: 8,
          TOKEN_ADDRESS: '0x5555f75e3d5278082200Fb451D1b6bA946D8e13b', // ibJPY
          TOKEN_SYMBOL: 'IBJPY',
        },
        {
          AGGREGATOR_ADDRESS: '0x02f878a94a1ae1b15705acd65b5519a46fe3517e', // EUR/USD
          FEED_ADDRESS: '0xb49f677943BC038e9857d61E7d053CaA2C1734C1', // EUR/USD
          FEED_DECIMALS: 8,
          TOKEN_ADDRESS: '0x96E61422b6A9bA0e068B6c5ADd4fFaBC6a4aae27', // ibEUR
          TOKEN_SYMBOL: 'IBEUR',
        },
        {
          AGGREGATOR_ADDRESS: '0x86e345d4113e1105053a81240c75b56b437da6ef', // KRW/USD
          FEED_ADDRESS: '0x01435677fb11763550905594a16b645847c1d0f3', // KRW/USD
          FEED_DECIMALS: 8,
          TOKEN_ADDRESS: '0x95dFDC8161832e4fF7816aC4B6367CE201538253', // ibKRW
          TOKEN_SYMBOL: 'IBKRW',
        },
      ],
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {};

export enum SYMBOL {
  DAI = 'DAI',
  IBAUD = 'IBAUD',
  IBCHF = 'IBCHF',
  IBEUR = 'IBEUR',
  IBGBP = 'IBGBP',
  IBJPY = 'IBJPY',
  IBKRW = 'IBKRW',
  MIM = 'MIM',
}
