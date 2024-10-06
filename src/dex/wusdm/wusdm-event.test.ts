import dotenv from 'dotenv';

dotenv.config();

import { WusdmEventPool } from './wusdm-pool';
import { WUSDMConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import wUSDM_ABI from '../../abi/wUSDM.json';
import { DEPOSIT_TOPIC, WITHDRAW_TOPIC } from './constants';
import { testEventSubscriber } from '../../../tests/utils-events';
import { WusdmPoolState } from './types';

import { Interface } from '@ethersproject/abi';
import _ from 'lodash';

jest.setTimeout(50 * 1000);
const networks = [
  Network.MAINNET,
  Network.ARBITRUM,
  Network.BASE,
  Network.POLYGON,
  Network.OPTIMISM,
];

async function fetchPoolState(
  wusdmPool: WusdmEventPool,
  blockNumber: number,
): Promise<WusdmPoolState> {
  const eventState = wusdmPool.getState(blockNumber);
  if (eventState) return eventState;
  const onChainState = await wusdmPool.generateState(blockNumber);
  wusdmPool.setState(onChainState, blockNumber);
  return onChainState;
}

describe('Wusdm', function () {
  const dexKey = 'Wusdm';
  const multichainBlockNumbers: {
    [network: string]: { [eventName: string]: number[] };
  } = {
    [Network.MAINNET]: {
      deposit: [20808811, 20692902, 20685702],
      withdraw: [20873278, 20869272, 20862960],
    },
    [Network.ARBITRUM]: {
      deposit: [259463653, 259456755, 259448821],
      withdraw: [259421319, 259420791, 259419437],
    },
    [Network.BASE]: {
      deposit: [20521934, 20460747, 20436449],
      withdraw: [20492729, 20409282, 20274826],
    },
    [Network.POLYGON]: {
      deposit: [62509681, 62359608, 62160587],
      withdraw: [62505429, 62381506, 62125779],
    },
    [Network.OPTIMISM]: {
      deposit: [126118678, 126116167, 126110439],
      withdraw: [126113314, 126108196, 126107784],
    },
  };

  networks.forEach(network => {
    describe(`${network}`, function () {
      const wUSDMAddress = WUSDMConfig['wUSDM'][network].wUSDMAddress;
      const wUSDMIface = new Interface(wUSDM_ABI);

      const blockNumbers = multichainBlockNumbers[network];

      Object.keys(blockNumbers).forEach((event: string) => {
        blockNumbers[event].forEach((blockNumber: number) => {
          it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
            const dexHelper = new DummyDexHelper(network);
            const logger = dexHelper.getLogger(dexKey);

            const wusdmPool = new WusdmEventPool(
              dexKey,
              network,
              `wusdm-pool`,
              dexHelper,
              wUSDMAddress,
              wUSDMIface,
              logger,
              DEPOSIT_TOPIC,
              WITHDRAW_TOPIC,
            );

            await wusdmPool.initialize(blockNumber);

            await testEventSubscriber(
              wusdmPool,
              wusdmPool.addressesSubscribed,
              (_blockNumber: number) => fetchPoolState(wusdmPool, _blockNumber),
              blockNumber,
              `${dexKey}_${wUSDMAddress}`,
              dexHelper.provider,
            );
          });
        });
      });
    });
  });
});
