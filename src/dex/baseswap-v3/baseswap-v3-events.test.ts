/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import _ from 'lodash';
import { BaseswapV3EventPool } from './baseswap-v3-pool';
import { BaseswapV3Config } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { Interface } from '@ethersproject/abi';
import ERC20ABI from '../../abi/erc20.json';
import StateMulticallABI from '../../abi/uniswap-v3/UniswapV3StateMulticall.abi.json';
import { AbiItem } from 'web3-utils';

jest.setTimeout(300 * 1000);
const dexKey = 'BaseswapV3';
const network = Network.BASE;
const config = BaseswapV3Config[dexKey][network];

async function fetchPoolStateFromContract(
  baseswapV3Pool: BaseswapV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `BaseswapV3: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Be careful to not request state prior to contract deployment
  // Otherwise need to use manual state sourcing from multicall
  // We had that mechanism, but removed it with this commit
  // You can restore it, but better just to find block after state multicall
  // deployment
  const state = baseswapV3Pool.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

describe('BaseswapV3 Event', function () {
  const poolAddress = '0xEf3C164b0feE8Eb073513E88EcEa280A58cC9945';
  const poolFeeCode = 450n;
  const token0 = '0x4200000000000000000000000000000000000006';
  const token1 = '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'; // USDbC

  const blockNumbers: { [eventName: string]: number[] } = {
    ['Swap']: [
      5574195, 5574217, 5574296, 5574296, 5574369, 5574404, 5574489, 5574522,
      5574566, 5574579, 5574587, 5574588, 5574611, 5574657, 5574712, 5574737,
      5574761, 5574806, 5574851, 5574896, 5574918, 5574982, 5575086, 5575110,
      5575308, 5575378, 5575490, 5575668,
    ],
    ['Burn']: [
      5575845, 5609704, 5609704, 5612315, 5612770, 5616727, 5617522, 5617821,
      5620232, 5622253,
    ],
    // topic0 - 0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde
    ['Mint']: [
      5594704, 5595166, 5606630, 5609854, 5612343, 5612386, 5612959, 5613707,
      5619196, 5620167, 5622035, 5622391, 5644261, 5645562, 5647711, 5649108,
      5649161, 5649377, 5651799, 5652903,
    ],
    // topic0 - 0x973d8d92bb299f4af6ce49b52a8adb85ae46b9f214c4c4fc06ac77401237b133
    ['SetFeeProtocol']: [],
    // topic0 - 0xac49e518f90a358f652e4400164f05a5d8f7e35e7747279bc3a93dbf584e125a
    // There are some events on blockNumbers: 13125816, 12733621, 12591465
    // But stateMulticall is not deployed at that time. So I just remove that check
    // I think it is not important actually
    ['IncreaseObservationCardinalityNext']: [],
    ['Collect']: [
      5575845, 5609704, 5612315, 5612770, 5616727, 5617522, 5617821, 5620232,
      5622253, 5642348, 5643915, 5645799, 5646074, 5647176, 5650388, 5650466,
      5653068, 5655334, 5655462, 5656401, 5657882, 5658500, 5659898, 5663603,
      5663999, 5664004, 5670005, 5671343, 5673141,
    ],
    ['Flash']: [],
  };

  describe('BaseswapV3EventPool', () => {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`${event}:${blockNumber} - should return correct state`, async function () {
          const dexHelper = new DummyDexHelper(network);
          // await dexHelper.init();

          const logger = dexHelper.getLogger(dexKey);

          // readonly dexHelper: IDexHelper,
          // parentName: string,
          // readonly stateMultiContract: Contract,
          // readonly decodeStateMultiCallResultWithRelativeBitmaps:
          //   | DecodeStateMultiCallFunc
          //   | undefined,
          // readonly erc20Interface: Interface,
          // protected readonly factoryAddress: Address,
          // public feeCode: bigint,
          // token0: Address,
          // token1: Address,
          // logger: Logger,
          // mapKey: string = '',
          // readonly poolInitCodeHash: string,

          const uniswapV3Pool = new BaseswapV3EventPool(
            dexHelper,
            dexKey,
            new dexHelper.web3Provider.eth.Contract(
              StateMulticallABI as AbiItem[],
              config.stateMulticall,
            ),
            undefined,
            new Interface(ERC20ABI),
            config.factory,
            poolFeeCode,
            token0,
            token1,
            logger,
            undefined,
            config.initHash,
          );

          // It is done in generateState. But here have to make it manually
          uniswapV3Pool.poolAddress = poolAddress.toLowerCase();
          uniswapV3Pool.addressesSubscribed[0] = poolAddress;

          await testEventSubscriber(
            uniswapV3Pool,
            uniswapV3Pool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolStateFromContract(
                uniswapV3Pool,
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
