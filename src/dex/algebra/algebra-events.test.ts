/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import _ from 'lodash';
import { AlgebraConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { Interface } from '@ethersproject/abi';
import ERC20ABI from '../../abi/erc20.json';
import StateMulticallABI from '../../abi/algebra/AlgebraStateMulticall.abi.json';
import { AbiItem } from 'web3-utils';
import { AlgebraEventPool } from './algebra-pool';

jest.setTimeout(300 * 1000);
const dexKey = 'QuickSwapV3';
const network = Network.POLYGON;
const config = AlgebraConfig[dexKey][network];

async function fetchPoolStateFromContract(
  algebraPool: AlgebraEventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `Algebra: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Be careful to not request state prior to contract deployment
  // Otherwise need to use manual state sourcing from multicall
  // We had that mechanism, but removed it with this commit
  // You can restore it, but better just to find block after state multicall
  // deployment
  const state = algebraPool.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

describe('Algebra Event', function () {
  const poolAddress = '0x5b41eedcfc8e0ae47493d4945aa1ae4fe05430ff';
  const token0 = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
  const token1 = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';

  const blockNumbers: { [eventName: string]: number[] } = {
    // topic0 - 0x598b9f043c813aa6be3426ca60d1c65d17256312890be5118dab55b0775ebe2a
    ['Fee']: [
      44940320, 44940321, 44940347, 44940402, 44940419, 44940438, 44940443,
      44940447, 44940451, 44940482, 44940505, 44940509, 44940512, 44940530,
      44940557, 44940560, 44940577, 44940609, 44940647, 44940648, 44940654,
      44940659, 44940664, 44940673, 44940675, 44940711, 44940715, 44940717,
      44940719, 44940768, 44940769, 44940783, 44940791,
    ],
    // topic0 - 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
    ['Swap']: [
      44940320, 44940320, 44940321, 44940347, 44940402, 44940419, 44940438,
      44940443, 44940447, 44940451, 44940482, 44940505, 44940509, 44940512,
      44940530, 44940557, 44940560, 44940577, 44940609, 44940647, 44940648,
      44940654, 44940659, 44940664, 44940673, 44940675, 44940711, 44940715,
      44940719, 44940768, 44940769, 44940783, 44940791,
    ],
    // topic0 - 0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde
    ['Mint']: [44940717],
    // topic0 - 0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c
    ['Burn']: [44940695],
    // topic0 - 0xbdbdb71d7860376ba52b25a5028beea23581364a40522f6bcfb86bb1f2dca633
    ['Flash']: [],
    // topic0 - 0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0
    ['Collect']: [],
    // topic0 - 0x9e22b964b08e25c3aaa72102bb0071c089258fb82d51271a8ddf5c24921356ee
    ['CommunityFee']: [],
  };

  describe('AlgebraEventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);
          // await dexHelper.init();

          const logger = dexHelper.getLogger(dexKey);

          const algebraPool = new AlgebraEventPool(
            dexHelper,
            dexKey,
            new dexHelper.web3Provider.eth.Contract(
              StateMulticallABI as AbiItem[],
              config.algebraStateMulticall,
            ),
            new Interface(ERC20ABI),
            config.factory,
            token0,
            token1,
            logger,
            undefined,
            config.initHash,
            config.deployer,
          );

          // It is done in generateState. But here have to make it manually
          algebraPool.poolAddress = poolAddress.toLowerCase();
          algebraPool.addressesSubscribed[0] = poolAddress;

          await testEventSubscriber(
            algebraPool,
            algebraPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolStateFromContract(
                algebraPool,
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
