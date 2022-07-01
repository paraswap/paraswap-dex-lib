import { Config, Address, Token } from './types';
import { Network } from './constants';
import { isETHAddress } from './utils';

// Hardcoded and envionment values from which actual config is derived
type BaseConfig = {
  network: number;
  networkName: string;
  isTestnet: boolean;
  mainnetNetwork?: number;
  nativeTokenName?: string;
  nativeTokenSymbol: string;
  wrappedNativeTokenName?: string;
  wrappedNativeTokenSymbol?: string;
  wrappedNativeTokenAddress: Address;
  hasEIP1559: boolean;
  augustusAddress: Address;
  tokenTransferProxyAddress: Address;
  multicallV2Address: Address;
  privateHttpProvider?: string;
  adapterAddresses: { [name: string]: Address };
  uniswapV2ExchangeRouterAddress: Address;
};

const baseConfigs: { [network: number]: BaseConfig } = {
  [Network.MAINNET]: {
    network: Network.MAINNET,
    networkName: 'Ethereum Mainnet',
    isTestnet: false,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    hasEIP1559: true,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    privateHttpProvider: process.env.HTTP_PROVIDER,
    adapterAddresses: {
      Adapter01: '0x3A0430bF7cd2633af111ce3204DB4b0990857a6F',
      Adapter02: '0xFC2Ba6E830a04C25e207B8214b26d8C713F6881F',
      Adapter03: '0xe5993623FF3ecD1f550124059252dDff804b3879',
      BuyAdapter: '0xe56823aC543c81f747eD95F3f095b5A19224bd3a',
    },
    uniswapV2ExchangeRouterAddress:
      '0xF9234CB08edb93c0d4a4d4c70cC3FfD070e78e07',
  },
  [Network.ROPSTEN]: {
    network: Network.ROPSTEN,
    networkName: 'Ethereum Ropsten Testnet',
    isTestnet: true,
    mainnetNetwork: Network.MAINNET,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    hasEIP1559: true,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    privateHttpProvider: process.env.HTTP_PROVIDER_3,
    adapterAddresses: {
      RopstenAdapter01: '0x59b7F6258e78C3E5234bb651656EDd0e08868cd5',
      RopstenBuyAdapter: '0x63e908A4C793a33e40254362ED1A5997a234D85C',
    },
    uniswapV2ExchangeRouterAddress:
      '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  },
  [Network.BSC]: {
    network: Network.BSC,
    networkName: 'Binance Smart Chain Mainnet',
    isTestnet: false,
    nativeTokenSymbol: 'BNB',
    wrappedNativeTokenAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    hasEIP1559: false,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0xC50F4c1E81c873B2204D7eFf7069Ffec6Fbe136D',
    privateHttpProvider: process.env.HTTP_PROVIDER_56,
    adapterAddresses: {
      BscAdapter01: '0xC9229EeC07B176AcC448BE33177c2834c9575ec5',
      BscBuyAdapter: '0xF52523B9d788F4E2Dd256dc5077879Af0448c37A',
    },
    uniswapV2ExchangeRouterAddress:
      '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  },
  [Network.POLYGON]: {
    network: Network.POLYGON,
    networkName: 'Polygon Mainnet',
    isTestnet: false,
    nativeTokenName: 'Matic',
    nativeTokenSymbol: 'MATIC',
    wrappedNativeTokenAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    hasEIP1559: true,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0x275617327c958bD06b5D6b871E7f491D76113dd8',
    privateHttpProvider: process.env.HTTP_PROVIDER_137,
    adapterAddresses: {
      PolygonAdapter01: '0xD458FA906121d9081970Ed3937df50C8Ba88E9c0',
      PolygonAdapter02: '0xAD1732884CF5aAB27B293707757a9b9011611bE6',
      PolygonBuyAdapter: '0xDc514c500dB446F5a7Ab80872bAf3adDEfd00174',
    },
    uniswapV2ExchangeRouterAddress:
      '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
  },
  [Network.AVALANCHE]: {
    network: Network.AVALANCHE,
    networkName: 'Avalanche Mainnet C-Chain',
    isTestnet: false,
    nativeTokenName: 'Avax',
    nativeTokenSymbol: 'AVAX',
    wrappedNativeTokenAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    hasEIP1559: true,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0xd7Fc8aD069f95B6e2835f4DEff03eF84241cF0E1',
    privateHttpProvider: process.env.HTTP_PROVIDER_43114,
    adapterAddresses: {
      AvalancheAdapter01: '0xb41Ec6e014e2AD12Ae8514216EAb2592b74F19e7',
      AvalancheBuyAdapter: '0xe92b586627ccA7a83dC919cc7127196d70f55a06',
    },
    uniswapV2ExchangeRouterAddress:
      '0x53e693c6C7FFC4446c53B205Cf513105Bf140D7b',
  },
  [Network.FANTOM]: {
    network: Network.FANTOM,
    networkName: 'Fantom Opera Mainnet',
    isTestnet: false,
    nativeTokenName: 'Fantom',
    nativeTokenSymbol: 'FTM',
    wrappedNativeTokenAddress: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
    hasEIP1559: false,
    augustusAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
    tokenTransferProxyAddress: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    multicallV2Address: '0xdC6E2b14260F972ad4e5a31c68294Fba7E720701',
    privateHttpProvider: process.env.HTTP_PROVIDER_250,
    adapterAddresses: {
      FantomAdapter01: '0xF52523B9d788F4E2Dd256dc5077879Af0448c37A',
      FantomBuyAdapter: '0x27eb327B7255a2bF666EBB4D60AB4752dA4611b9',
    },
    uniswapV2ExchangeRouterAddress:
      '0xAB86e2bC9ec5485a9b60E684BA6d49bf4686ACC2',
  },
  [Network.ARBITRUM]: {
    network: Network.ARBITRUM,
    networkName: 'Arbitrum One',
    isTestnet: false,
    nativeTokenName: 'Ether',
    nativeTokenSymbol: 'ETH',
    wrappedNativeTokenAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    hasEIP1559: false,
    augustusAddress: '0x1120dd8772c1cbD4e3F0bC141AB1BC7eeaFbdAf0', //TODO: replace
    tokenTransferProxyAddress: '0x3CfCE32338b1aB2530313033f58553BaD3B879e5', //TODO: replace
    multicallV2Address: '0x7eCfBaa8742fDf5756DAC92fbc8b90a19b8815bF',
    privateHttpProvider: process.env.HTTP_PROVIDER_42161,
    adapterAddresses: {
      ArbitrumAdapter01: '0x5b99094C3c2129F17b78cE5eBD1Cd8ADB887b340',
      ArbitrumBuyAdapter: '0x56a14A1954b5d5FD7C636a24137a93742bA708b9',
    },
    uniswapV2ExchangeRouterAddress:
      '0x0310983446288E08f1Dd973148F194A685Ea551F',
  },
};

// Should not be used, except by internal test code
export function generateConfig(network: number): Config {
  const baseConfig = baseConfigs[network];
  if (!baseConfig) {
    throw new Error(`No configuration found for network ${network}`);
  }
  const nativeTokenName =
    baseConfig.nativeTokenName || baseConfig.nativeTokenSymbol;
  if (!baseConfig.privateHttpProvider) {
    throw new Error(`Missing HTTP Provider for network ${network}`);
  }
  return {
    network: baseConfig.network,
    networkName: baseConfig.networkName,
    isTestnet: baseConfig.isTestnet,
    mainnetNetwork: baseConfig.mainnetNetwork,
    nativeTokenName,
    nativeTokenSymbol: baseConfig.nativeTokenSymbol,
    wrappedNativeTokenName:
      baseConfig.wrappedNativeTokenName || `Wrapped ${nativeTokenName}`,
    wrappedNativeTokenSymbol:
      baseConfig.wrappedNativeTokenSymbol || `W${baseConfig.nativeTokenSymbol}`,
    wrappedNativeTokenAddress: baseConfig.wrappedNativeTokenAddress,
    hasEIP1559: baseConfig.hasEIP1559,
    augustusAddress: baseConfig.augustusAddress,
    tokenTransferProxyAddress: baseConfig.tokenTransferProxyAddress,
    multicallV2Address: baseConfig.multicallV2Address,
    privateHttpProvider: baseConfig.privateHttpProvider,
    adapterAddresses: { ...baseConfig.adapterAddresses },
    uniswapV2ExchangeRouterAddress: baseConfig.uniswapV2ExchangeRouterAddress,
  };
}

export class ConfigHelper {
  constructor(public data: Config) {}

  wrapETH(token: Token): Token {
    return isETHAddress(token.address)
      ? { address: this.data.wrappedNativeTokenAddress, decimals: 18 }
      : token;
  }

  isWETH(tokenAddress: Address): boolean {
    return (
      tokenAddress.toLowerCase() ===
      this.data.wrappedNativeTokenAddress.toLowerCase()
    );
  }
}
