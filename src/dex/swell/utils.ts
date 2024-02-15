import { Contract } from 'web3-eth-contract';
import { SWETHPoolState } from './type';
import { Interface, AbiCoder } from '@ethersproject/abi';

const coder = new AbiCoder();

export async function getOnChainState(
  multiContract: Contract,
  poolAddress: string,
  poolInterface: Interface,
  blockNumber: number | 'latest',
): Promise<SWETHPoolState> {
  const data: { returnData: any[] } = await multiContract.methods
    .aggregate([
      {
        target: poolAddress,
        callData: poolInterface.encodeFunctionData('swETHToETHRate', []),
      },
    ])
    .call({}, blockNumber);

  const decodedData = coder.decode(['uint256'], data.returnData[0]);

  const swETHToETHRateFixed = BigInt(decodedData[0].toString());

  return {
    swETHToETHRateFixed,
  };
}
