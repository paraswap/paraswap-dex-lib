import dotenv from 'dotenv';
dotenv.config();
import { InceptionEventPool } from './inception-event-pool';
import { InceptionPricePoolConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import INCEPTION_VAULT_ABI from '../../abi/inception/inception-vault.json';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { Interface } from '@ethersproject/abi';
import { setTokensOnNetwork } from './tokens';
import { getTokenList } from './utils';

jest.setTimeout(50 * 1000);
const dexKey = 'InceptionLRT';
const network = Network.MAINNET;
const ratioFeedAddress = InceptionPricePoolConfig[dexKey][network].ratioFeed;
const poolInterface = new Interface(INCEPTION_VAULT_ABI);

async function fetchPoolState(
  inceptionEventPool: InceptionEventPool,
  blockNumber: number,
): Promise<PoolState> {
  return inceptionEventPool.generateState(blockNumber);
}

describe('Inception Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    RatioUpdated: [20438963, 20431766, 20424602],
  };

  describe('InceptionEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}: ${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);
          const inceptionEventPool = new InceptionEventPool(
            dexKey,
            network,
            dexHelper,
            logger,
            {
              ratioFeedAddress: ratioFeedAddress,
              initState: {},
            },
            poolInterface,
          );

          const tokenList = await getTokenList(network);
          setTokensOnNetwork(network, tokenList);

          await testEventSubscriber(
            inceptionEventPool,
            inceptionEventPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(inceptionEventPool, _blockNumber),
            blockNumber,
            `${dexKey}_${ratioFeedAddress}`.toLowerCase(),
            dexHelper.provider,
          );
        });
      });
    });
  });
});
