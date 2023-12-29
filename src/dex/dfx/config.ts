import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const PANCAKE_SUPPORTED_FEES = [10000n, 2500n, 500n, 100n];

export const DfxConfig: DexConfigMap<DexParams> = {
  DFXV3: {
    [Network.MAINNET]: {
      factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
      curve: '0xa34317DB73e77d453b1B8d04550c44D10e981C8e',
      subgraphURL:
        'https://api.goldsky.com/api/public/project_clasdk93949ub0h10a9lf9pkq/subgraphs/amm-v3/0.0.3/gn',
      pools: {
        '0x814A90726fb9f7cf7566e28Db634Ff5Fa959CeB1': {
          id: 'cadcUsdc',
          source: 'dfx',
          pool: '0x814A90726fb9f7cf7566e28Db634Ff5Fa959CeB1',
          tokens: [
            '0xcaDC0acd4B445166f12d2C07EAc6E2544FbE2Eef',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
          lpt: '0x814A90726fb9f7cf7566e28Db634Ff5Fa959CeB1',
        },
        '0x58A8E0E6069ad4ee521BE15B46F8E499Fd389222': {
          id: 'eurcUsdc',
          source: 'dfx',
          pool: '0x58A8E0E6069ad4ee521BE15B46F8E499Fd389222',
          lpt: '0x58A8E0E6069ad4ee521BE15B46F8E499Fd389222',
          tokens: [
            '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
        },
        '0x32b3737e05226c837f24ed8B6C5970966A48F7F7': {
          id: 'gbptUsdc',
          source: 'dfx',
          pool: '0x32b3737e05226c837f24ed8B6C5970966A48F7F7',
          lpt: '0x32b3737e05226c837f24ed8B6C5970966A48F7F7',
          tokens: [
            '0x86B4dBE5D203e634a12364C0e428fa242A3FbA98',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
        },
        '0xEE309d1c4dCd289Ee93EBd456e491d51539503E4': {
          id: 'gyenUsdc',
          source: 'dfx',
          pool: '0xEE309d1c4dCd289Ee93EBd456e491d51539503E4',
          lpt: '0xEE309d1c4dCd289Ee93EBd456e491d51539503E4',
          tokens: [
            '0xC08512927D12348F6620a698105e1BAac6EcD911',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
        },
        '0x0a62A05cD19CDF1065BB92D3A885470B920b7Bb7': {
          id: 'trybUsdc',
          source: 'dfx',
          pool: '0x0a62A05cD19CDF1065BB92D3A885470B920b7Bb7',
          lpt: '0x0a62A05cD19CDF1065BB92D3A885470B920b7Bb7',
          tokens: [
            '0x2C537E5624e4af88A7ae4060C022609376C8D0EB',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
        },
        '0x64423386B619e0f50f2619a67070688edbDA80b7': {
          id: 'xidrUsdc',
          source: 'dfx',
          pool: '0x64423386B619e0f50f2619a67070688edbDA80b7',
          lpt: '0x64423386B619e0f50f2619a67070688edbDA80b7',
          tokens: [
            '0xebF2096E01455108bAdCbAF86cE30b6e5A72aa52',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
        },
        '0x512c1d73c2c3b68FDc0424ebb6Ed4734984CD20d': {
          id: 'xsgdUsdc',
          source: 'dfx',
          pool: '0x512c1d73c2c3b68FDc0424ebb6Ed4734984CD20d',
          lpt: '0x512c1d73c2c3b68FDc0424ebb6Ed4734984CD20d',
          tokens: [
            '0x70e8dE73cE538DA2bEEd35d14187F6959a8ecA96',
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          ],
        },
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter02', index: 9 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 9 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 9 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 6 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 3 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 2 }],
  },
};
