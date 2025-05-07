import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const StabullConfig: DexConfigMap<DexParams> = {
  Stabull: {
    [Network.MAINNET]: {
      factory: '0xadc6D0407f87FE31da213Bb6d042AF87faeFeecd',
      router: '0x871af97122D08890193e8D6465015f6D9e2889b2',
      curve: '0x2e9E34b5Af24b66F12721113C1C8FFcbB7Bc8051',
      quoteCurrency: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      pools: {
        '0xe37d763c7c4cdd9a8f085f7db70139a0843529f3': {
          id: 'nzdsUsdc',
          source: 'stabull',
          pool: '0xe37d763c7c4cdd9a8f085f7db70139a0843529f3',
          tokens: [
            '0xda446fad08277b4d2591536f204e018f32b6831c',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
          lpt: '0xe37d763c7c4cdd9a8f085f7db70139a0843529f3',
          tokenAssim: '0xda446fad08277b4d2591536f204e018f32b6831c',
          usdcAssim: '0x3cd821f5f8c77d060f725b7252e7c6fb68072b51',
        },
        '0x865040f92ac6cca1b9683c03d843799d8e6d1282': {
          id: 'eursUsdc',
          source: 'stabull',
          pool: '0x865040f92ac6cca1b9683c03d843799d8e6d1282',
          lpt: '0x865040f92ac6cca1b9683c03d843799d8e6d1282',
          tokens: [
            '0xdB25f211AB05b1c97D595516F45794528a807ad8',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
          tokenAssim: '0xdB25f211AB05b1c97D595516F45794528a807ad8',
          usdcAssim: '0x3cd821f5f8c77d060f725b7252e7c6fb68072b51',
        },
        '0xc1a195fdb17da5771d470a232545550a7d264809': {
          id: 'trybUsdc',
          source: 'stabull',
          pool: '0xc1a195fdb17da5771d470a232545550a7d264809',
          lpt: '0xc1a195fdb17da5771d470a232545550a7d264809',
          tokens: [
            '0x2c537e5624e4af88a7ae4060c022609376c8d0eb',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
          tokenAssim: '0x2c537e5624e4af88a7ae4060c022609376c8d0eb',
          usdcAssim: '0x3cd821f5f8c77d060f725b7252e7c6fb68072b51',
        },
        '0x402878106b88b41fad1200b47e998c8effd0d887': {
          id: '1gbpUsdc',
          source: 'stabull',
          pool: '0x402878106b88b41fad1200b47e998c8effd0d887',
          lpt: '0x402878106b88b41fad1200b47e998c8effd0d887',
          tokens: [
            '0x86B4dBE5D203e634a12364C0e428fa242A3FbA98',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
          tokenAssim: '0x86B4dBE5D203e634a12364C0e428fa242A3FbA98',
          usdcAssim: '0x3cd821f5f8c77d060f725b7252e7c6fb68072b51',
        },
        '0x01e4013c478d7f02112c3cf178f2771c842edbd0': {
          id: 'gyenUsdc',
          source: 'stabull',
          pool: '0x01e4013c478d7f02112c3cf178f2771c842edbd0',
          lpt: '0x01e4013c478d7f02112c3cf178f2771c842edbd0',
          tokens: [
            '0xC08512927D12348F6620a698105e1BAac6EcD911',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
          tokenAssim: '0xC08512927D12348F6620a698105e1BAac6EcD911',
          usdcAssim: '0x3cd821f5f8c77d060f725b7252e7c6fb68072b51',
        },
      },
    },
    [Network.POLYGON]: {
      factory: '0xf40F8B2010EAB1F1F459956D13a2fF5091070e03',
      router: '0x0C1F53e7b5a770f4C0d4bEF139F752EEb08de88d',
      curve: '0x3c60234Db40e6e5b57504E401B1Cdc79D91Faf89',
      quoteCurrency: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      pools: {
        '0xdcb7efACa996fe2985138bF31b647EFcd1D0901a': {
          id: 'nzdsUsdc',
          source: 'stabull',
          pool: '0xdcb7efACa996fe2985138bF31b647EFcd1D0901a',
          tokens: [
            '0xFbBE4b730e1e77d02dC40fEdF9438E2802eab3B5',
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          ],
          lpt: '0xdcb7efACa996fe2985138bF31b647EFcd1D0901a',
          tokenAssim: '0x9360e289F9Ed5702D848194f98E24055E13E5eC9',
          usdcAssim: '0x7A7901031a9aAB7bb9204de285a75cB7CB7C537b',
        },
        '0xF80b3a8977d34A443a836a380B2FCe69A1A4e819': {
          id: 'eursUsdc',
          source: 'stabull',
          pool: '0xF80b3a8977d34A443a836a380B2FCe69A1A4e819',
          tokens: [
            '0xE111178A87A3BFf0c8d18DECBa5798827539Ae99',
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          ],
          lpt: '0xF80b3a8977d34A443a836a380B2FCe69A1A4e819',
          tokenAssim: '0xe545dd2D800d7D452d136721412406a0744151A5',
          usdcAssim: '0x7A7901031a9aAB7bb9204de285a75cB7CB7C537b',
        },
        '0x55BDf7f0223e8B1D509141a8D852Dd86B3553d59': {
          id: 'trybUsdc',
          source: 'stabull',
          pool: '0x55BDf7f0223e8B1D509141a8D852Dd86B3553d59',
          tokens: [
            '0x4Fb71290Ac171E1d144F7221D882BECAc7196EB5',
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          ],
          lpt: '0x55BDf7f0223e8B1D509141a8D852Dd86B3553d59',
          tokenAssim: '0x681019de7518CAc40916d8c2031a1b476E8709c9',
          usdcAssim: '0x7A7901031a9aAB7bb9204de285a75cB7CB7C537b',
        },
        '0x509aACb7746166252eCb0d62BfBA097CC9731e20': {
          id: 'xsgdUsdc',
          source: 'stabull',
          pool: '0x509aACb7746166252eCb0d62BfBA097CC9731e20',
          tokens: [
            '0xDC3326e71D45186F113a2F448984CA0e8D201995',
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          ],
          lpt: '0x509aACb7746166252eCb0d62BfBA097CC9731e20',
          tokenAssim: '0x5a6302601Cb1AB614787D5d623132191cfF5D30f',
          usdcAssim: '0x7A7901031a9aAB7bb9204de285a75cB7CB7C537b',
        },
        '0xce0abd182d2cf5844f2a0cb52cfcc55d4ff4fcba': {
          id: 'brzUsdc',
          source: 'stabull',
          pool: '0xce0abd182d2cf5844f2a0cb52cfcc55d4ff4fcba',
          tokens: [
            '0x4ed141110f6eeeaba9a1df36d8c26f684d2475dc',
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          ],
          lpt: '0xce0abd182d2cf5844f2a0cb52cfcc55d4ff4fcba',
          tokenAssim: '0x257f91ee9cdbbe1c0f806ffd947753b3dd5b6b7d',
          usdcAssim: '0x7A7901031a9aAB7bb9204de285a75cB7CB7C537b',
        },
        '0x3d4436Ba3aE7e0E6361C83Ab940Ea779Cd598206': {
          id: 'usdtUsdc',
          source: 'stabull',
          pool: '0x3d4436Ba3aE7e0E6361C83Ab940Ea779Cd598206',
          tokens: [
            '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          ],
          lpt: '0x3d4436Ba3aE7e0E6361C83Ab940Ea779Cd598206',
          tokenAssim: '0x364f4e88a77644Cb1b28B5105c56A98872255BeD',
          usdcAssim: '0x7A7901031a9aAB7bb9204de285a75cB7CB7C537b',
        },
        '0xA52508B1822ca9261B33213b233694F846aBD0ED': {
          id: 'daiUsdc',
          source: 'stabull',
          pool: '0xA52508B1822ca9261B33213b233694F846aBD0ED',
          tokens: [
            '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          ],
          lpt: '0xA52508B1822ca9261B33213b233694F846aBD0ED',
          tokenAssim: '0xfD4ED8280571fca7D767Bc1efAbe4BE279Ff4290',
          usdcAssim: '0x7A7901031a9aAB7bb9204de285a75cB7CB7C537b',
        },
        '0x1233003461F654cf1c0d7dB19e753BAdef05A87f': {
          id: 'phpcUsdc',
          source: 'stabull',
          pool: '0x1233003461F654cf1c0d7dB19e753BAdef05A87f',
          tokens: [
            '0x87a25dc121Db52369F4a9971F664Ae5e372CF69A',
            '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          ],
          lpt: '0x1233003461F654cf1c0d7dB19e753BAdef05A87f',
          tokenAssim: '0xbF02DEA97fe1A3c26939DA3a21018505bebbe552',
          usdcAssim: '0x7A7901031a9aAB7bb9204de285a75cB7CB7C537b',
        },
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter01', // Name of your adapter contract
        index: 0, // Index of the adapter in the list
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BuyAdapter',
        index: 5,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter02',
        index: 1,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'PolygonBuyAdapter',
        index: 2,
      },
    ],
  },
};
