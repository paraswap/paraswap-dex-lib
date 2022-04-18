import { UniswapV2, UniswapV2Pair, UniswapV2PoolState } from './uniswap-v2';
import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { IDexHelper } from '../../dex-helper';
import { AbiCoder, Interface } from '@ethersproject/abi';
import { DexParams } from './types';
import { getDexKeysWithNetwork } from '../../utils';
import _ from 'lodash';
import TetuSwapPoolABI from '../../abi/uniswap-v2/tetuswap-pool.json';

const coder = new AbiCoder();

export const TetuSwapConfig: DexConfigMap<DexParams> = {
  TetuSwap: {
    [Network.POLYGON]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/tetu-io/tetu-swap',
      factoryAddress: '0x684d8c187be836171a1Af8D533e4724893031828',
      router: '0xBCA055F25c3670fE0b1463e8d470585Fe15Ca819',
      // To PR reviewer:
      // init code changed after pair #14 at TetuSwap due proxy updates
      // can it brake any features and how to do the best with it?
      initCode:
        '0x9dd68abe415b704148c6c3d8eb18d3d1bdce7546a0b4710eadacb3dbb8392014', // init code for pairs #0-#14 and up
      // initCode: 'e056de145445a04a03aec762fdf145d748a50b3219721fa209c4c69db5c6cb7a', // init code for pairs #15 and up
      poolGasCost: 1000 * 1000, // TetuSwap use SmartVault deposits / withdrawals during swap, so its costly
      feeCode: 10,
    },
  },
};

export class TetuSwap extends UniswapV2 {
  tetuSwapPool: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(TetuSwapConfig);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      true,
      TetuSwapConfig[dexKey][network].factoryAddress,
      TetuSwapConfig[dexKey][network].subgraphURL,
      TetuSwapConfig[dexKey][network].initCode,
      TetuSwapConfig[dexKey][network].feeCode,
      TetuSwapConfig[dexKey][network].poolGasCost,
    );
    this.tetuSwapPool = new Interface(TetuSwapPoolABI);
  }

  async getManyPoolReserves(
    pairs: UniswapV2Pair[],
    blockNumber: number,
  ): Promise<UniswapV2PoolState[]> {
    try {
      const multiCallFeeData = pairs.map(pair =>
        this.getFeesMultiCallData(pair.exchange!),
      );

      const calldata = pairs
        .map((pair, i) => {
          let calldata = [
            {
              target: pair.exchange,
              callData: this.tetuSwapPool.encodeFunctionData('getReserves', []),
            },
          ];
          if (this.isDynamicFees) calldata.push(multiCallFeeData[i]!.callEntry);
          return calldata;
        })
        .flat();

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const returnData = _.chunk(data.returnData, this.isDynamicFees ? 3 : 2);
      return pairs.map((pair, i) => {
        const decodedData = coder.decode(
          ['uint112', 'uint112', 'uint32'],
          returnData[i][0],
        );

        return {
          reserves0: decodedData[0].toString(),
          reserves1: decodedData[1].toString(),
          feeCode: this.isDynamicFees
            ? multiCallFeeData[i]!.callDecoder(returnData[i][1])
            : this.feeCode,
        };
      });
    } catch (e) {
      this.logger.error(
        `Error_getManyPoolReserves could not get reserves with error:`,
        e,
      );
      return [];
    }
  }

  protected getFeesMultiCallData(poolAddress: Address) {
    const callEntry = {
      target: poolAddress,
      callData: this.tetuSwapPool.encodeFunctionData('fee', []),
    };
    const callDecoder = (values: any[]) =>
      parseInt(
        this.tetuSwapPool.decodeFunctionResult('fee', values)[0].toString(),
      );
    return {
      callEntry,
      callDecoder,
    };
  }
}
