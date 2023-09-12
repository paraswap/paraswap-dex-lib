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
  name: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum';
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
            18066464, // the last one contains multiple Snyc events
          ],
          ['Transfer']: [18064025, 18064045, 18065266],
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
