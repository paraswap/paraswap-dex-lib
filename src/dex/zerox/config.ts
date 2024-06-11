import { Network } from '../../constants';

export const ZRX_EXCHANGE: Record<number, Record<number, string>> = {
  [Network.MAINNET]: {
    2: '0x080bf510fcbf18b91105470639e9561022937712',
    3: '0x61935CbDd02287B511119DDb11Aeb42F1593b7Ef',
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
  [Network.BSC]: {
    2: '0x3F93C3D9304a70c9104642AB8cD37b1E2a7c203A',
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
  [Network.POLYGON]: {
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
};

export const ZRX_EXCHANGE_ERC20PROXY: Record<number, Record<number, string>> = {
  [Network.MAINNET]: {
    1: '0x95E6F48254609A6ee006F7D493c8e5fB97094ceF',
    2: '0x95E6F48254609A6ee006F7D493c8e5fB97094ceF',
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
  [Network.BSC]: {
    2: '0xCF21d4b7a265FF779accBA55Ace0F56C8cE6e379',
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
  [Network.POLYGON]: {
    4: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  },
};
