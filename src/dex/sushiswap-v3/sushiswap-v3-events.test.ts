/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { SushiswapV3EventPool } from './sushiswap-v3-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import ERC20ABI from '../../abi/erc20.json';
import StateMulticallABI from '../../abi/uniswap-v3/UniswapV3StateMulticall.abi.json';
import { AbiItem } from 'web3-utils';
import { Interface } from 'ethers/lib/utils';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  sushiswapV3Pool: SushiswapV3EventPool,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const message = `UniswapV3: ${poolAddress} blockNumber ${blockNumber}`;
  console.log(`Fetching state ${message}`);
  // Be careful to not request state prior to contract deployment
  // Otherwise need to use manual state sourcing from multicall
  // We had that mechanism, but removed it with this commit
  // You can restore it, but better just to find block after state multicall
  // deployment
  const state = sushiswapV3Pool.generateState(blockNumber);
  console.log(`Done ${message}`);
  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('SushiswapV3 EventPool Mainnet', function () {
  const dexKey = 'SushiswapV3';
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let sushiswapV3Pool: SushiswapV3EventPool;

  const factory = '0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F';
  const poolFeeCode = 500n;
  const token0 = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  const token1 = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  const stateMulticall = '0x9c764D2e92dA68E4CDfD784B902283A095ff8b63';
  const initCodeHash =
    '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    ['0x35644fb61afbc458bf92b15add6abc1996be5014']: {
      // topic0 - 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
      ['Swap']: [
        17293592, 17293446, 17293111, 17289023, 17280383, 17280375, 17279057,
      ],
      // // topic0 - 0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c
      ['Burn']: [17259974],
      // // topic0 - 0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde
      ['Mint']: [17215311],
      // // topic0 - 0x973d8d92bb299f4af6ce49b52a8adb85ae46b9f214c4c4fc06ac77401237b133
      ['SetFeeProtocol']: [16988973],
      // // topic0 - 0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0
      ['Collect']: [17259974],
    },
  };

  beforeEach(async () => {
    sushiswapV3Pool = new SushiswapV3EventPool(
      dexHelper,
      dexKey,
      new dexHelper.web3Provider.eth.Contract(
        StateMulticallABI as AbiItem[],
        stateMulticall,
      ),
      new Interface(ERC20ABI),
      factory,
      poolFeeCode,
      token0,
      token1,
      logger,
      undefined,
      initCodeHash,
    );
  });

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await testEventSubscriber(
                    sushiswapV3Pool,
                    [poolAddress],
                    (_blockNumber: number) =>
                      fetchPoolState(
                        sushiswapV3Pool,
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
          },
        );
      });
    },
  );
});
