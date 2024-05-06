import { Contract } from 'web3-eth-contract';
import { SDaiPoolState } from './types';
import { Interface, AbiCoder } from '@ethersproject/abi';
import { currentBigIntTimestampInS } from '../../utils';

const coder = new AbiCoder();

// - `dsr`: the Dai Savings Rate
// - `chi`: the Rate Accumulator
// - `rho`: time of last drip
export async function getOnChainState(
  multiContract: Contract,
  potAddress: string,
  potInterface: Interface,
  blockNumber: number | 'latest',
): Promise<SDaiPoolState> {
  const data: { returnData: any[] } = await multiContract.methods
    .aggregate([
      {
        target: potAddress,
        callData: potInterface.encodeFunctionData('dsr', []),
      },
      {
        target: potAddress,
        callData: potInterface.encodeFunctionData('chi', []),
      },
      {
        target: potAddress,
        callData: potInterface.encodeFunctionData('rho', []),
      },
    ])
    .call({}, blockNumber);

  const [dsr, chi, rho] = data.returnData.map(item =>
    coder.decode(['uint256'], item)[0].toString(),
  );

  return {
    dsr,
    chi,
    rho,
  };
}
