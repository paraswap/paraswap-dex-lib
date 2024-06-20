import { Contract } from 'web3-eth-contract';
import { PoolState } from './types';
import { AbiCoder, Interface } from '@ethersproject/abi';

const coder = new AbiCoder();

export async function getOnChainRatio(
  multiContract: Contract,
  poolAddress: string,
  poolInterface: Interface,
  blockNumber: number | 'latest',
): Promise<PoolState> {
  const data: { returnData: any[] } = await multiContract.methods
    .aggregate([
      {
        target: poolAddress,
        callData: poolInterface.encodeFunctionData('ratio', []),
      },
    ])
    .call({}, blockNumber);

  const decodedData = coder.decode(['uint256'], data.returnData[0]);

  const ratio = BigInt(decodedData[0].toString());

  return {
    ratio,
  };
}
