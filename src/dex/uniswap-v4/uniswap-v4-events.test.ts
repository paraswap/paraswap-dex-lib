import { Network } from '../../constants';
import { UniswapV4Config } from '../uniswap-v4/config';
import { DummyDexHelper } from '../../dex-helper';
import { AbiItem } from 'web3-utils';
import { decodeStateMultiCallResultWithRelativeBitmaps } from '../uniswap-v3/utils';
import { Interface } from '@ethersproject/abi';
import ERC20ABI from '../../abi/erc20.json';
import { testEventSubscriber } from '../../../tests/utils-events';
import { UniswapV4PoolManager } from './uniswap-v4-pool-manager';

jest.setTimeout(300 * 1000);
const dexKey = 'UniswapV4';

describe('UniswapV4 events', () => {
  const blockNumbers: { [eventName: string]: number[] } = {
    ['Swap']: [],
    ['Donate']: [],
    ['Initialize']: [],
    ['ModifyLiquidity']: [],
  };

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const config = UniswapV4Config[dexKey][network];

    describe('UniswapV4PoolManager', () => {
      Object.keys(blockNumbers).forEach((event: string) => {
        blockNumbers[event].forEach((blockNumber: number) => {
          it(`${event}:${blockNumber} - should return correct state`, async function () {
            const dexHelper = new DummyDexHelper(network);
            // await dexHelper.init();

            const logger = dexHelper.getLogger(dexKey);

            const uniswapV4PoolManager = new UniswapV4PoolManager(
              dexHelper,
              dexKey,
              new dexHelper.web3Provider.eth.Contract(
                StateMulticallABI as AbiItem[],
                config.stateMulticall,
              ),
              decodeStateMultiCallResultWithRelativeBitmaps,
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
});
