import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

const BASE_TOKENS = {
  btcbAddress: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  ethAddress: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  usdcAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  usdtAddress: '0x55d398326f99059fF775485246999027B3197955',
  xvsAddress: '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63',
};

const TOKEN_CONVERTERS = {
  btcbPrimeConverterAddress: '0xE8CeAa79f082768f99266dFd208d665d2Dd18f53',
  ethPrimeConverterAddress: '0xca430B8A97Ea918fF634162acb0b731445B8195E',
  usdcPrimeConverterAddress: '0xa758c9C215B6c4198F0a0e3FA46395Fa15Db691b',
  usdtPrimeConverterAddress: '0xD9f101AA67F3D72662609a2703387242452078C3',
  xvsVaultConverterAddress: '0xd5b9AE835F4C59272032B3B954417179573331E0',
};

export const VenusConfig: DexConfigMap<DexParams> = {
  BtcbPrimeConverter: {
    [Network.BSC]: {
      subgraphURL: '2ZCWgaBc8KoWW8kh7MRzf9KPdr7NTZ5cda9bxpFDk4wG',
      baseAssetAddress: BASE_TOKENS.btcbAddress,
      converterAddress: TOKEN_CONVERTERS.btcbPrimeConverterAddress,
      protocolShareReserve: '0xCa01D5A9A248a830E9D93231e791B1afFed7c446',
    },
  },
  EthPrimeConverter: {
    [Network.BSC]: {
      subgraphURL: '2ZCWgaBc8KoWW8kh7MRzf9KPdr7NTZ5cda9bxpFDk4wG',
      baseAssetAddress: BASE_TOKENS.ethAddress,
      converterAddress: TOKEN_CONVERTERS.ethPrimeConverterAddress,
      protocolShareReserve: '0xCa01D5A9A248a830E9D93231e791B1afFed7c446',
    },
  },
  UsdcPrimeConverter: {
    [Network.BSC]: {
      subgraphURL: '2ZCWgaBc8KoWW8kh7MRzf9KPdr7NTZ5cda9bxpFDk4wG',
      baseAssetAddress: BASE_TOKENS.usdcAddress,
      converterAddress: TOKEN_CONVERTERS.usdcPrimeConverterAddress,
      protocolShareReserve: '0xCa01D5A9A248a830E9D93231e791B1afFed7c446',
    },
  },
  UsdtPrimeConverter: {
    [Network.BSC]: {
      subgraphURL: '2ZCWgaBc8KoWW8kh7MRzf9KPdr7NTZ5cda9bxpFDk4wG',
      baseAssetAddress: BASE_TOKENS.usdtAddress,
      converterAddress: TOKEN_CONVERTERS.usdtPrimeConverterAddress,
      protocolShareReserve: '0xCa01D5A9A248a830E9D93231e791B1afFed7c446',
    },
  },
  XvsVaultConverter: {
    [Network.BSC]: {
      subgraphURL: '2ZCWgaBc8KoWW8kh7MRzf9KPdr7NTZ5cda9bxpFDk4wG',
      baseAssetAddress: BASE_TOKENS.xvsAddress,
      converterAddress: TOKEN_CONVERTERS.xvsVaultConverterAddress,
      protocolShareReserve: '0xCa01D5A9A248a830E9D93231e791B1afFed7c446',
    },
  },
};
