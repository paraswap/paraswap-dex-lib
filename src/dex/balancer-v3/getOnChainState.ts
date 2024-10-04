import _ from 'lodash';
import {
  ImmutablePoolStateMap,
  CommonMutableState,
  PoolStateMap,
  StableMutableState,
} from './types';
import { BalancerV3Config } from './config';
import { Interface, Result } from '@ethersproject/abi';
import { IDexHelper } from '../../dex-helper';

interface callData {
  target: string;
  callData: string;
}

// Encoding & Decoding for onchain calls to fetch mutable pool data
// Each supported pool type should have its own specific calls if needed
const poolOnChain: Record<
  string,
  {
    count: number;
    encode: (
      network: number,
      contractInterface: Interface,
      address: string,
    ) => callData[];
    decode: (
      contractInterface: Interface,
      poolAddress: string,
      data: any,
      startIndex: number,
    ) => {} | CommonMutableState | StableMutableState;
  }
> = {
  ['COMMON']: {
    count: 6,
    ['encode']: (
      network: number,
      contractInterface: Interface,
      address: string,
    ): callData[] => {
      return [
        {
          target: BalancerV3Config.BalancerV3[network].vaultAddress,
          callData: contractInterface.encodeFunctionData('getPoolTokenRates', [
            address,
          ]),
        },
        {
          target: BalancerV3Config.BalancerV3[network].vaultAddress,
          callData: contractInterface.encodeFunctionData(
            'getCurrentLiveBalances',
            [address],
          ),
        },
        {
          target: BalancerV3Config.BalancerV3[network].vaultAddress,
          callData: contractInterface.encodeFunctionData('getPoolConfig', [
            address,
          ]),
        },
        {
          target: BalancerV3Config.BalancerV3[network].vaultAddress,
          callData: contractInterface.encodeFunctionData('totalSupply', [
            address,
          ]),
        },
        {
          target: BalancerV3Config.BalancerV3[network].vaultAddress,
          callData: contractInterface.encodeFunctionData('isPoolPaused', [
            address,
          ]),
        },
        {
          target: BalancerV3Config.BalancerV3[network].vaultAddress,
          callData: contractInterface.encodeFunctionData('getHooksConfig', [
            address,
          ]),
        },
      ];
    },
    ['decode']: (
      contractInterface: Interface,
      poolAddress: string,
      data: any,
      startIndex: number,
    ): CommonMutableState => {
      const resultTokenRates = decodeThrowError(
        contractInterface,
        'getPoolTokenRates',
        data[startIndex++],
        poolAddress,
      );
      if (!resultTokenRates)
        throw new Error(
          `Failed to get result for getPoolTokenRates for ${poolAddress}`,
        );
      const resultLiveBalances = decodeThrowError(
        contractInterface,
        'getCurrentLiveBalances',
        data[startIndex++],
        poolAddress,
      );
      if (!resultLiveBalances)
        throw new Error(
          `Failed to get result for getPoolTokenRates for ${poolAddress}`,
        );
      const resultGetPoolConfig = decodeThrowError(
        contractInterface,
        'getPoolConfig',
        data[startIndex++],
        poolAddress,
      );
      if (!resultGetPoolConfig)
        throw new Error(
          `Failed to get result for getPoolConfig for ${poolAddress}`,
        );
      const resultTotalSupply = decodeThrowError(
        contractInterface,
        'totalSupply',
        data[startIndex++],
        poolAddress,
      );
      if (!resultTotalSupply)
        throw new Error(
          `Failed to get result for totalSupply for ${poolAddress}`,
        );
      const resultIsPoolPaused = decodeThrowError(
        contractInterface,
        'isPoolPaused',
        data[startIndex++],
        poolAddress,
      );
      if (!resultIsPoolPaused)
        throw new Error(
          `Failed to get result for isPoolPaused for ${poolAddress}`,
        );
      const resultHooksConfig = decodeThrowError(
        contractInterface,
        'getHooksConfig',
        data[startIndex++],
        poolAddress,
      );
      if (!resultHooksConfig)
        throw new Error(
          `Failed to get result for resultHooksConfig for ${poolAddress}`,
        );
      return {
        tokenRates: resultTokenRates.tokenRates.map((r: string) => BigInt(r)),
        balancesLiveScaled18: resultLiveBalances.balancesLiveScaled18.map(
          (b: string) => BigInt(b),
        ),
        swapFee: BigInt(resultGetPoolConfig[0].staticSwapFeePercentage),
        aggregateSwapFee: BigInt(
          resultGetPoolConfig[0].aggregateSwapFeePercentage,
        ),
        totalSupply: BigInt(resultTotalSupply[0]),
        scalingFactors: resultTokenRates.decimalScalingFactors.map(
          (r: string) => BigInt(r),
        ),
        isPoolPaused: resultIsPoolPaused[0],
        hasHook:
          resultHooksConfig[0].hooksContract !==
          '0x0000000000000000000000000000000000000000',
      };
    },
  },
  ['WEIGHTED']: {
    count: 0,
    ['encode']: (
      network: number,
      contractInterface: Interface,
      address: string,
    ): callData[] => {
      return [];
    },
    ['decode']: (
      contractInterface: Interface,
      poolAddress: string,
      data: any,
      startIndex: number,
    ) => {
      return {};
    },
  },
  ['STABLE']: {
    count: 1,
    ['encode']: (
      network: number,
      contractInterface: Interface,
      address: string,
    ): callData[] => {
      return [
        {
          target: address,
          callData: contractInterface.encodeFunctionData(
            'getAmplificationParameter',
          ),
        },
      ];
    },
    ['decode']: (
      contractInterface: Interface,
      poolAddress: string,
      data: any,
      startIndex: number,
    ): StableMutableState => {
      const resultAmp = decodeThrowError(
        contractInterface,
        'getAmplificationParameter',
        data[startIndex++],
        poolAddress,
      );
      if (!resultAmp)
        throw new Error(
          `Failed to get result for getAmplificationParameter for ${poolAddress}`,
        );
      return {
        amp: resultAmp[0].toBigInt(),
      };
    },
  },
};

export function decodeThrowError(
  contractInterface: Interface,
  functionName: string,
  resultEntry: { success: boolean; returnData: any },
  poolAddress: string,
): Result {
  if (!resultEntry.success)
    throw new Error(`Failed to execute ${functionName} for ${poolAddress}`);
  return contractInterface.decodeFunctionResult(
    functionName,
    resultEntry.returnData,
  );
}

// Any data from API will be immutable. Mutable data such as balances, etc will be fetched via onchain/event state.
export async function getOnChainState(
  network: number,
  immutablePoolStateMap: ImmutablePoolStateMap,
  dexHelper: IDexHelper,
  interfaces: {
    [name: string]: Interface;
  },
  blockNumber: number,
): Promise<PoolStateMap> {
  const multiCallData = Object.entries(immutablePoolStateMap)
    .map(([address, pool]) => {
      return [
        ...poolOnChain['COMMON'].encode(network, interfaces['VAULT'], address),
        ...poolOnChain[pool.poolType].encode(
          network,
          interfaces[pool.poolType],
          address,
        ),
      ];
    })
    .flat();

  // 500 is an arbitrary number chosen based on the blockGasLimit
  const slicedMultiCallData = _.chunk(multiCallData, 500);

  const multicallData = (
    await Promise.all(
      slicedMultiCallData.map(async _multiCallData =>
        dexHelper.multiContract.methods
          .tryAggregate(false, _multiCallData)
          .call({}, blockNumber),
      ),
    )
  ).flat();

  let i = 0;
  const poolStateMap = Object.fromEntries(
    Object.entries(immutablePoolStateMap).map(([address, pool]) => {
      const commonMutableData = poolOnChain['COMMON'].decode(
        interfaces['VAULT'],
        address,
        multicallData,
        i,
      ) as CommonMutableState;
      i = i + poolOnChain['COMMON'].count;
      const poolMutableData = poolOnChain[pool.poolType].decode(
        interfaces[pool.poolType],
        address,
        multicallData,
        i,
      );
      i = i + poolOnChain[pool.poolType].count;
      return [
        address,
        {
          ...pool,
          ...commonMutableData,
          ...poolMutableData,
        },
      ];
    }),
  );
  return poolStateMap;
}
