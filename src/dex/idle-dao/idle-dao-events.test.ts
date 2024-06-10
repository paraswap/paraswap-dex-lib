/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { IdleDao } from './idle-dao';
import { IdleDaoEventPool } from './idle-dao-pool';
import { Network } from '../../constants';
import { Address, Logger } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState, IdleToken } from './types';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  idleDaoPool: IdleDaoEventPool,
  blockNumber: number,
  poolAddress: string,
  logger: Logger,
): Promise<PoolState> {
  const state = await idleDaoPool.generateState(blockNumber);
  return state;
}

type EventMappings = Record<string, number[]>;

describe('IdleDao EventPool Mainnet', function () {
  const dexKey = 'IdleDao';
  let latestBlockNumber: number;
  const network = Network.MAINNET;
  let tokensList: Record<string, IdleToken>;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  const idleDao: IdleDao = new IdleDao(network, dexKey, dexHelper);

  beforeAll(async () => {
    latestBlockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    await idleDao.initializePricing(latestBlockNumber);
    tokensList = await idleDao.getTokensList(latestBlockNumber);
  });

  // poolAddress -> EventMappings
  const eventsToTest: Record<
    Address,
    { blockNumber: number; events: EventMappings }
  > = {
    // BB_dUSDCV3
    '0x2a84a042db06222c486bcb815e961f26599d0df6': {
      blockNumber: 19676846,
      events: {
        Transfer: [
          19676846, // DepositAA
          19676851, // DepositBB
          19681374, // Harvest
          19681547, // WithdrawBB
          20031918, // Harvest
          20036646,
        ],
      },
    },
    // BB_clearpool_fasanara_USDT
    '0x3eb6318b8d9f362a0e1d99f6032edb1c4c602500': {
      blockNumber: 18341913,
      events: {
        Transfer: [
          18341913, // DepositBB
          18357425, // WithdrawBB
          18646128, // DepositBB
          18804244, // WithdrawAA
          18908679, // Harvest
          20036646,
        ],
      },
    },
    '0x7b713b1cb6eafd4061064581579ffccf7df21545': {
      blockNumber: 18985108,
      events: {
        Transfer: [
          18985108, // DepositBB
          18997082, // WithdrawBB
          19013537, // Harvest
          19346397, // DepositAA
          20036646,
        ],
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
                      fetchPoolState(
                        idleDaoPool!,
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
          },
        );
      });
    },
  );
});
