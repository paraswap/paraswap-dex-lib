import {
  UniswapV2,
  UniswapV2EventPool,
  UniswapV2Pair,
  UniswapV2PoolState,
} from './uniswap-v2';
import { Network } from '../../constants';
import { Address, DexConfigMap } from '../../types';
import { IDexHelper } from '../../dex-helper';
import { AbiCoder, Interface } from '@ethersproject/abi';
import { DexParams } from './types';
import { getDexKeysWithNetwork } from '../../utils';
import _ from 'lodash';
import TetuSwapPoolABI from '../../abi/uniswap-v2/tetuswap-pool.json';
import { DeepReadonly } from 'ts-essentials';

const coder = new AbiCoder();
const tetuSwapPool = new Interface(TetuSwapPoolABI);

export const TetuSwapConfig: DexConfigMap<DexParams> = {
  TetuSwap: {
    [Network.POLYGON]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/tetu-io/tetu-swap',
      factoryAddress: '0x684d8c187be836171a1Af8D533e4724893031828',
      router: '0xBCA055F25c3670fE0b1463e8d470585Fe15Ca819',
      initCode: '0x0',
      poolGasCost: 1000 * 1000, // TetuSwap use SmartVault deposits / withdrawals during swap, so its costly
      feeCode: 0, // fee is dynamic, default value for all pools is 10
    },
  },
};

export class TetuSwapEventPool extends UniswapV2EventPool {
  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<UniswapV2PoolState>> {
    let calldata = [
      {
        target: this.poolAddress,
        callData: tetuSwapPool.encodeFunctionData('getReserves', []),
      },
    ];

    if (this.dynamicFees) {
      calldata.push(this.feesMultiCallEntry!);
    }

    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber);

    const decodedData = coder.decode(
      ['uint112', 'uint112', 'uint32'],
      data.returnData[0],
    );

    return {
      reserves0: decodedData[0].toString(),
      reserves1: decodedData[1].toString(),
      feeCode: this.dynamicFees
        ? this.feesMultiCallDecoder!(data.returnData[1])
        : this.feeCode,
    };
  }
}

export class TetuSwap extends UniswapV2 {
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
  }

  protected async addPool(
    pair: UniswapV2Pair,
    reserves0: string,
    reserves1: string,
    feeCode: number,
    blockNumber: number,
  ) {
    const { callEntry, callDecoder } =
      this.getFeesMultiCallData(pair.exchange!) || {};
    const _eventPool = new TetuSwapEventPool(
      this.dexKey,
      this.dexHelper,
      pair.exchange!,
      pair.token0,
      pair.token1,
      feeCode,
      this.logger,
      this.isDynamicFees,
      callEntry,
      callDecoder,
    );
    await super.addPool(
      pair,
      reserves0,
      reserves1,
      feeCode,
      blockNumber,
      _eventPool,
    );
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
              callData: tetuSwapPool.encodeFunctionData('getReserves', []),
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
      callData: tetuSwapPool.encodeFunctionData('fee', []),
    };
    const callDecoder = (values: any[]) =>
      parseInt(tetuSwapPool.decodeFunctionResult('fee', values)[0].toString());
    return {
      callEntry,
      callDecoder,
    };
  }
}
