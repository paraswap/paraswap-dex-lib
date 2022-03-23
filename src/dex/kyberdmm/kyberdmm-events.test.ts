import dotenv from 'dotenv';
dotenv.config();

import { KyberDmmPool, KyberDmmPoolState } from './pool';
import BigNumber from 'bignumber.js';
import { KyberDmmConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { Tokens } from './../../../tests/constants-e2e';
import { DeepReadonly } from 'ts-essentials';

jest.setTimeout(50 * 1000);

const dexKey = 'KyberDmm';
const network = Network.MAINNET;
const config = KyberDmmConfig[dexKey][network];
const tokens = Tokens[network];

type PoolParam = {
  address: string;
  token0Symbol: string;
  token1Symbol: string;
  ampBps: BigNumber;
};

const poolsParams: PoolParam[] = [
  {
    address: '0xD343d5dba2FBa55EEF58189619c05e33CAB95cA1',
    ampBps: new BigNumber(15000),
    token0Symbol: 'WBTC',
    token1Symbol: 'USDT',
  },
  {
    address: '0x1cf68Bbc2b6D3C6CfE1BD3590CF0E10b06a05F17',
    ampBps: new BigNumber(20000),
    token0Symbol: 'WBTC',
    token1Symbol: 'WETH',
  },
  {
    address: '0xA97642500517C728cE1339A466DE0F10C19034CD',
    ampBps: new BigNumber(10000),
    token0Symbol: 'REQ',
    token1Symbol: 'WETH',
  },
];

async function fetchPoolState(
  kyberDmmPool: KyberDmmPool,
  blockNumber: number,
): Promise<DeepReadonly<KyberDmmPoolState>> {
  return kyberDmmPool.generateState(blockNumber);
}

describe('KyberDmm Event', function () {
  const blockNumbers: { [eventName: string]: [number, PoolParam][] } = {
    Sync: [
      [14336994, poolsParams[0]],
      [14341503, poolsParams[0]],
      [14340012, poolsParams[0]],
      [14336359, poolsParams[0]],
      [14341726, poolsParams[0]],
      [14337005, poolsParams[1]],
      [14339216, poolsParams[1]],
      [14336398, poolsParams[1]],
      [14336231, poolsParams[1]],
      [14340006, poolsParams[1]],
      [14336723, poolsParams[2]],
      [14336819, poolsParams[2]],
      [14337049, poolsParams[2]],
      [14337053, poolsParams[2]],
      [14338292, poolsParams[2]],
    ],
    UpdateEMA: [
      [14336994, poolsParams[0]],
      [14340012, poolsParams[0]],
      [14341503, poolsParams[0]],
      [14336359, poolsParams[0]],
      [14341726, poolsParams[0]],
      [14337005, poolsParams[1]],
      [14339216, poolsParams[1]],
      [14336398, poolsParams[1]],
      [14336231, poolsParams[1]],
      [14340006, poolsParams[1]],
      [14336723, poolsParams[2]],
      [14336819, poolsParams[2]],
      [14337049, poolsParams[2]],
      [14337053, poolsParams[2]],
      [14338292, poolsParams[2]],
    ],
  };

  describe('KyberDmmPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach(([blockNumber, poolParam]) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);

          const kyberDmmPool = new KyberDmmPool(
            dexKey,
            dexHelper,
            poolParam.address,
            tokens[poolParam.token0Symbol],
            tokens[poolParam.token1Symbol],
            poolParam.ampBps,
            logger,
          );

          await testEventSubscriber(
            kyberDmmPool,
            [poolParam.address],
            (_blockNumber: number) =>
              fetchPoolState(kyberDmmPool, _blockNumber),
            blockNumber,
            `${dexKey}_${poolParam.address}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
