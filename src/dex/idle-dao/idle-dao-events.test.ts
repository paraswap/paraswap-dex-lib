/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { IdleDao } from './idle-dao';
import { IdleDaoEventPool } from './idle-dao-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState, IdleToken } from './types';
import { getIdleTokenByAddress } from './tokens';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  idleDaoPool: IdleDaoEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  return await idleDaoPool.generateState(blockNumber);
}

type EventMappings = Record<string, number[]>;

describe('IdleDao EventPool Mainnet', function () {
  const dexKey = 'IdleDao';
  const network = Network.MAINNET;
  let tokensList: Record<string, IdleToken>;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  const idleDao: IdleDao = new IdleDao(network, dexKey, dexHelper);

  beforeAll(async () => {
    const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    tokensList = await idleDao.getTokensList(blockNumber);
  });

  // poolAddress -> EventMappings
  const eventsToTest: Record<
    Address,
    { blockNumber: number; events: EventMappings }
  > = {
    '0x00b51fc6384a120eac68bea38b889ea92524ab93': {
      blockNumber: 18019399,
      events: {
        Transfer: Object.keys(Array.from('0'.repeat(5))).map(
          index => 18019399 + +index * 10,
        ),
      },
    },
    '0x3eb6318b8d9f362a0e1d99f6032edb1c4c602500': {
      blockNumber: 16947910,
      events: {
        Transfer: Object.keys(Array.from('0'.repeat(5))).map(
          index => 16947910 + +index * 10,
        ),
      },
    },
    '0x4d9d9aa17c3fcea05f20a87fc1991a045561167d': {
      blockNumber: 15076447,
      events: {
        Transfer: Object.keys(Array.from('0'.repeat(5))).map(
          index => 15076447 + +index * 10,
        ),
      },
    },
  };

  Object.entries(eventsToTest).forEach(
    ([poolAddress, { blockNumber, events }]: [
      string,
      { blockNumber: number; events: EventMappings },
    ]) => {
      describe(`Events for ${poolAddress}`, () => {
        let idleDaoPool: IdleDaoEventPool | null;

        it(`idleDaoPool for ${network} - ${poolAddress} - ${blockNumber}`, async function () {
          idleDaoPool = await idleDao.setupEventPool(
            tokensList[poolAddress],
            blockNumber,
          );
          expect(idleDaoPool).not.toBeNull();
        });

        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await testEventSubscriber(
                    idleDaoPool!,
                    idleDaoPool!.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(idleDaoPool!, _blockNumber, poolAddress),
                    blockNumber,
                    `${dexKey}_${poolAddress}`,
                    dexHelper.provider,
                  );
                });
              });
            });
          },
        );
      });
    },
  );
});
