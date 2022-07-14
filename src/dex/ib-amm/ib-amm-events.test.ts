import dotenv from 'dotenv';
dotenv.config();

import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { IbAmmConfig } from './config';
import { IbAmmPool } from './pool';
import { IbAmmPoolState } from './types';

jest.setTimeout(50 * 1000);
const dexKey = 'IbAmm';
const network = Network.MAINNET;
const config = IbAmmConfig[dexKey][network];
const poolIdentifier = `${dexKey}_${config.IBAMM_ADDRESS}`;

async function fetchPoolState(
  ibAmmPool: IbAmmPool,
  blockNumber: number,
): Promise<IbAmmPoolState> {
  return await ibAmmPool.generateState(blockNumber);
}

describe('IbAmm Event', function () {
  const blockNumbers = {
    AnswerUpdated: [
      [14336994],
      [14340012],
      [14341503],
      [14336359],
      [14341726],
      [14337005],
      [14339216],
      [14336398],
      [14336231],
      [14340006],
      [14336723],
      [14336819],
      [14337049],
      [14337053],
      [14338292],
    ],
  };

  describe('IbAmm', function () {
    blockNumbers.AnswerUpdated.forEach(([blockNumber]) => {
      it(`Should return the correct state after the ${blockNumber}:AnswerUpdated`, async function () {
        const dexHelper = new DummyDexHelper(network);

        const ibAmmPool = new IbAmmPool(
          dexKey,
          network,
          poolIdentifier,
          config.IB_TOKENS,
          dexHelper,
        );

        await testEventSubscriber(
          ibAmmPool,
          ibAmmPool.addressesSubscribed,
          (_blockNumber: number) => fetchPoolState(ibAmmPool, _blockNumber),
          blockNumber,
          `${dexKey}_${poolIdentifier}`,
          dexHelper.provider,
        );
      });
    });
  });
});
