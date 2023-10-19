/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { PancakeswapV3Config } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { Interface } from '@ethersproject/abi';
import ERC20ABI from '../../abi/erc20.json';
import StateMulticallABI from '../../abi/pancakeswap-v3/PancakeV3StateMulticall.abi.json';
import { AbiItem } from 'web3-utils';
import { PancakeSwapV3EventPool } from './pancakeswap-v3-pool';
import { PoolState } from '../uniswap-v3/types';

jest.setTimeout(300 * 1000);
const dexKey = 'PancakeswapV3';
const network = Network.MAINNET;
const config = PancakeswapV3Config[dexKey][network];

async function fetchPoolStateFromContract(
  pancakeswapV3Pool: PancakeSwapV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState | undefined> {
  const message = `PancakeswapV3: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Be careful to not request state prior to contract deployment
  // Otherwise need to use manual state sourcing from multicall
  // We had that mechanism, but removed it with this commit
  // You can restore it, but better just to find block after state multicall
  // deployment
  const state = await pancakeswapV3Pool.generateState(blockNumber);

  console.log(`Done ${message}`);

  return state;
}

describe('PancakeswapV3 Event', function () {
  const poolAddress = '0x04c8577958CcC170EB3d2CCa76F9d51bc6E42D8f';
  const poolFeeCode = 100n;
  const token0 = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const token1 = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

  const blockNumbers: { [eventName: string]: number[] } = {
    ['Swap']: [
      17030597, 17031935, 17032362, 17035931, 17038708, 17039103, 17039688,
      17039812, 17046030, 17046317, 17046694, 17047063, 17047219, 17056731,
      17057640, 17057862, 17057892, 17057955, 17063052, 17063127, 17063524,
      17091869, 17093155, 17093506, 17146325, 17146863, 17147474, 17147830,
      17154952, 17159976, 17160283, 17160720, 17233700, 17234168, 17234407,
      17234433, 17242498, 17242712, 17243089, 17276770, 17277552, 17277733,
      17320467,
    ],
    ['Burn']: [
      17030970, 17031054, 17031107, 17031773, 17031838, 17033280, 17036092,
      17042331, 17042392, 17043224, 17097388, 17098794, 17099011, 17118506,
      17121704, 17143519, 17163847, 17207834, 17213897, 17249508, 17251725,
    ],
    ['Mint']: [
      17030284, 17031045, 17033298, 17033315, 17036173, 17042433, 17043299,
      17044836, 17044855, 17046316, 17047699, 17047732, 17050119, 17071407,
      17074384, 17090265, 17092669, 17093251, 17094015, 17121836, 17147932,
      17163857, 17172266, 17185894, 17194153, 17199371, 17249453,
    ],
    ['SetFeeProtocol']: [],
    ['IncreaseObservationCardinalityNext']: [],
    ['Collect']: [
      17117306, 17118506, 17121704, 17143519, 17147612, 17160005, 17163847,
      17192312, 17201868, 17205784, 17207834, 17213120, 17213897, 17241053,
      17249508, 17251725,
    ],
    ['Flash']: [],
  };

  describe('PancakeswapV3EventPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);

          const logger = dexHelper.getLogger(dexKey);

          const pancakeswapV3Pool = new PancakeSwapV3EventPool(
            dexHelper,
            dexKey,
            new dexHelper.web3Provider.eth.Contract(
              StateMulticallABI as AbiItem[],
              config.stateMulticall,
            ),
            new Interface(ERC20ABI),
            config.factory,
            poolFeeCode,
            token0,
            token1,
            logger,
            undefined,
            config.initHash,
            config.deployer,
          );

          // It is done in generateState. But here have to make it manually
          pancakeswapV3Pool.poolAddress = poolAddress.toLowerCase();
          pancakeswapV3Pool.addressesSubscribed[0] = poolAddress;

          await testEventSubscriber(
            pancakeswapV3Pool,
            pancakeswapV3Pool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolStateFromContract(
                pancakeswapV3Pool,
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
