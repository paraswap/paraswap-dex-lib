/* eslint-disable no-console */
import dotenv from 'dotenv';
import { Interface } from '@ethersproject/abi';
import { Tokens } from '../../../tests/constants-e2e';
dotenv.config();

import SmardexPoolLayerOneABI from '../../abi/smardex/layer-1/smardex-pool.json';
import SmardexPoolLayerTwoABI from '../../abi/smardex/layer-2/smardex-pool.json';
import { Smardex, SmardexEventPool } from './smardex';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { SmardexPoolState } from './types';

jest.setTimeout(120 * 1000);
const dexKey = 'Smardex';

type NetworkConfig = {
  name: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'base';
  network: Network;
  tokens: typeof Tokens[Network];
  pools: Array<{
    address: string;
    symbol0: string;
    symbol1: string;
    events: {
      [event: string]: number[];
    };
  }>;
};

const NETWORK_CONFIGS: NetworkConfig[] = [
  {
    name: 'ethereum',
    network: Network.MAINNET,
    tokens: Tokens[Network.MAINNET],
    pools: [
      {
        address: '0xd2bf378cea07fe117ffdfd3f5b7e53c2b0b78c05',
        symbol0: 'SDEX',
        symbol1: 'USDT',
        events: {
          ['Swap']: [
            18064045,
            18064060,
            18064194,
            18065266,
            18066464, // the last one contains multiple Swap events
          ],
          ['Burn']: [17231921, 17762042, 17762668],
          ['Mint']: [17739609, 17973926, 18062443],
          // ['FeesChanged']: [], // none on L1
          ['Sync']: [
            18064045,
            18064060,
            18064194,
            18065266,
            18066464, // the last one contains multiple Sync events
          ],
          ['Transfer']: [18064025, 18064045, 18065266],
        },
      },

      {
        address: '0xf3a4B8eFe3e3049F6BC71B47ccB7Ce6665420179',
        symbol0: 'SDEX',
        symbol1: 'ETH',
        events: {
          ['Swap']: [
            18120396,
            18120367, // multiple Swap events
            18119305,
            18118991,
            18120209,
          ],
          ['Burn']: [18114357, 18089610, 18026115],
          ['Mint']: [18115825, 18109975, 18093408],
          // ['FeesChanged']: [], // none on L1
          ['Sync']: [
            18120396,
            18120367, // multiple Sync events
            18119305,
            18118991,
            18120209,
          ],
          ['Transfer']: [18108643, 18105778, 18105793],
        },
      },
    ],
  },
  {
    name: 'polygon',
    network: Network.POLYGON,
    tokens: Tokens[Network.POLYGON],
    pools: [
      {
        address: '0x77476148B72ECB4E9f6A3cDDC5dd437Df1F003F3',
        symbol0: 'USDC',
        symbol1: 'SDEX',
        events: {
          ['Swap']: [47436997, 47437089, 47437096, 47445056, 47445066],
          ['Burn']: [47423778, 47334674, 46807911],
          ['Mint']: [47417315, 47414686, 47288517],
          ['FeesChanged']: [45861051],
          ['Sync']: [47436997, 47437089, 47437096, 47445056, 47445066],
          ['Transfer']: [47423778, 47403369, 47343062],
        },
      },
      {
        address: '0x7130d1Ab6d9C657240331A4DE3e88b5497Be9cEB',
        symbol0: 'WMATIC',
        symbol1: 'USDC',
        events: {
          ['Swap']: [47448993, 47449888, 47449861, 47448993, 47449214],
          ['Burn']: [47434291, 47433030, 47426957],
          ['Mint']: [47354112, 47268128, 47252146],
          ['FeesChanged']: [], // Fees didn't change on this pool
          ['Sync']: [47448993, 47449888, 47449861, 47448993, 47449214],
          ['Transfer']: [47338250, 47338178, 47333469],
        },
      },
    ],
  },
  {
    name: 'arbitrum',
    network: Network.ARBITRUM,
    tokens: Tokens[Network.ARBITRUM],
    pools: [
      {
        address: '0xacCDd9EE1DCd393E346e5d6350230439b4DA09ab',
        symbol0: 'SDEX',
        symbol1: 'USDC',
        events: {
          ['Swap']: [130424308, 130422563, 130418994, 130415253, 130382808],
          ['Burn']: [129969327, 129138853, 126200497],
          ['Mint']: [130028302, 129940404, 129728771],
          ['FeesChanged']: [], // Fees didn't change on this pool
          ['Sync']: [130424308, 130422563, 130418994, 130415253, 130382808],
          ['Transfer']: [130028373, 129918802, 129668897],
        },
      },
      {
        address: '0xD87899d10Eaa10F3adE05038A38251F758E5C0eb',
        symbol0: 'ARB',
        symbol1: 'USDC',
        events: {
          ['Swap']: [130429535, 130419879, 130417306, 130414469, 130416990],
          ['Burn']: [130200966, 127933595, 125698828],
          ['Mint']: [130263032, 130331095, 128594710],
          ['FeesChanged']: [], // Fees didn't change on this pool
          ['Sync']: [130429535, 130419879, 130417306, 130414469, 130416990],
          ['Transfer']: [130423567, 130423514, 130331095],
        },
      },
    ],
  },
  {
    name: 'bsc',
    network: Network.BSC,
    tokens: Tokens[Network.BSC],
    pools: [
      {
        address: '0xe7b89CbD4E833510F393CCfbE7D433EDbb137aB2',
        symbol0: 'USDT',
        symbol1: 'SDEX',
        events: {
          ['Swap']: [31678152, 31678000, 31674992, 31670581, 31675013],
          ['Burn']: [31660547, 31655719, 31539131],
          ['Mint']: [31652485, 31595468, 31571640],
          ['FeesChanged']: [30531399],
          ['Sync']: [31678152, 31678000, 31674992, 31670581, 31675013],
          ['Transfer']: [31660547, 31655777, 31655736],
        },
      },
      {
        address: '0xf315833053a1187fd5e9813E38BD59937492857a',
        symbol0: 'USDT',
        symbol1: 'BNB',
        events: {
          ['Swap']: [31678534, 31675409, 31678534, 31675014, 31674391],
          ['Burn']: [31666734, 31586726, 31462652],
          ['Mint']: [31662048, 31554796, 31524123],
          ['FeesChanged']: [], // Fees didn't change on this pool
          ['Sync']: [31678534, 31675409, 31678534, 31675014, 31674391],
          ['Transfer']: [31666734, 31632200, 31586970],
        },
      },
    ],
  },
  {
    name: 'base',
    network: Network.BASE,
    tokens: Tokens[Network.BASE],
    pools: [
      {
        address: '0xd70e1bab713d84c3a110ded11e41714542e604ba',
        symbol0: 'WETH',
        symbol1: 'SDEX',
        events: {
          ['Swap']: [4761865, 4757945, 4757945, 4757897],
          ['Burn']: [4692541],
          ['Mint']: [4757945, 4737306, 4701199],
          ['FeesChanged']: [], // Fees didn't change on this pool
          ['Sync']: [4761865, 4757945, 4757945, 4757897],
          ['Transfer']: [4757966, 4737315, 4736210],
        },
      },
      {
        address: '0x5a60c797993ee91f012260d995e1e6c6ce3dda6d',
        symbol0: 'WETH',
        symbol1: 'USDbC',
        events: {
          ['Swap']: [4763447, 4762313, 4762290],
          ['Burn']: [4716925, 4338322, 4282294],
          ['Mint']: [4758649, 4649129, 4645429],
          ['FeesChanged']: [], // Fees didn't change on this pool
          ['Sync']: [4763447, 4762313, 4762290],
          ['Transfer']: [4758649, 4716850, 4645429],
        },
      },
    ],
  },
];

async function fetchPoolStateFromContractAtBlock(
  smardexEventPool: SmardexEventPool,
  blockNumber: number,
  poolAddress: string,
  logger: any,
): Promise<SmardexPoolState | undefined> {
  const message = `Smardex: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);

  const state = await smardexEventPool.generateState(blockNumber);
  console.log(`Done ${message}`);

  return state;
}

NETWORK_CONFIGS.forEach(({ name, network, pools, tokens }) => {
  describe(`Events Tests on ${name}`, function () {
    pools.forEach(({ address, events, symbol0, symbol1 }) => {
      describe(`${symbol0} <> ${symbol1}`, function () {
        const poolAddress = address;
        const token0 = tokens[symbol0];
        const token1 = tokens[symbol1];
        // events in the same block must update the same element
        Object.keys(events).forEach((event: string) => {
          events[event].forEach((blockNumber: number) => {
            it(`${event}:${blockNumber} - should return correct state`, async function () {
              const dexHelper = new DummyDexHelper(network);

              const logger = dexHelper.getLogger(dexKey);
              const smardex = new Smardex(network, dexKey, dexHelper);
              const multicall = smardex.getFeesMultiCallData(poolAddress);
              const SmardexPool = new SmardexEventPool(
                new Interface(
                  smardex.isLayer1()
                    ? SmardexPoolLayerOneABI
                    : SmardexPoolLayerTwoABI,
                ),
                dexHelper,
                poolAddress,
                token0,
                token1,
                logger,
                multicall?.callEntry,
                multicall?.callDecoder,
                smardex.isLayer1(),
              );

              // It is done in generateState. But here have to make it manually
              SmardexPool.poolAddress = poolAddress.toLowerCase();
              SmardexPool.addressesSubscribed[0] = poolAddress.toLowerCase();

              await testEventSubscriber(
                SmardexPool,
                SmardexPool.addressesSubscribed,
                (_blockNumber: number) =>
                  fetchPoolStateFromContractAtBlock(
                    SmardexPool,
                    _blockNumber,
                    poolAddress,
                    logger,
                  ),
                blockNumber,
                `${dexKey}_${poolAddress}`,
                dexHelper.provider,
              );
            });
          });
        });
      });
    });
  });
});
