/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import _ from 'lodash';
import { DfynV2EventPool } from './dfyn-v2-pool';
import { DfynV2Config } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { Interface } from '@ethersproject/abi';
import ERC20ABI from '../../abi/erc20.json';
import { AbiItem } from 'web3-utils';
import DfynV2PoolHelper from '../../abi/dfyn-v2/DfynV2PoolHelper.abi.json'

jest.setTimeout(300 * 1000);
const dexKey = 'DfynV2';
const network = Network.POLYGON;
const config = DfynV2Config[dexKey][network];

async function fetchPoolStateFromContract(
  dfynV2Pool: DfynV2EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `DfynV2Pool: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Be careful to not request state prior to contract deployment
  // Otherwise need to use manual state sourcing from multicall
  // We had that mechanism, but removed it with this commit
  // You can restore it, but better just to find block after state multicall
  // deployment
  const state = await dfynV2Pool.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

describe('DfynV2 Event', function () {
  const poolAddress = '0x1a7c22A039dFbD3950F3B5B22aeA098DD25f8e94';
  const poolFeeCode = 1500n;
  const token0 = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
  const token1 = '0xC168E40227E4ebD8C1caE80F7a55a4F0e6D66C97';

  const blockNumbers: { [eventName: string]: number[] } = {
    // topic0 - 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
    ['Swap']: [
      43088200, 
      43167416    
    ],
  };

  describe('DfynV2EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          
          const dexHelper = new DummyDexHelper(network);
          // await dexHelper.init();

          const logger = dexHelper.getLogger(dexKey);

          const dfynV2Pool = new DfynV2EventPool(
            dexHelper,
            dexKey,
            new dexHelper.web3Provider.eth.Contract(
              DfynV2PoolHelper as AbiItem[],
              config.poolHelper,
            ),
            new Interface(ERC20ABI),
            config.factory,
            token0,
            token1,
            logger,
          );

          // It is done in generateState. But here have to make it manually
          dfynV2Pool.poolAddress = poolAddress.toLowerCase();
          dfynV2Pool.addressesSubscribed[0] = poolAddress;
          await testEventSubscriber(
            dfynV2Pool,
            dfynV2Pool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolStateFromContract(
                dfynV2Pool,
                _blockNumber,
                poolAddress,
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
