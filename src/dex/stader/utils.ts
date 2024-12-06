import { Contract } from 'web3-eth-contract';
import { ETHxPoolState } from './types';
import { Interface, AbiCoder } from '@ethersproject/abi';

export async function getOnChainStateETHx(
  multiContract: Contract,
  poolAddress: string,
  poolInterface: Interface,
  blockNumber: number | 'latest',
): Promise<ETHxPoolState> {
  const coder = new AbiCoder();
  const DECIMALS = BigInt(1000000000000000000n);
  const data: { returnData: any[] } = await multiContract.methods
    .aggregate([
      {
        target: poolAddress,
        callData: poolInterface.encodeFunctionData('getExchangeRate', []),
      },
    ])
    .call({}, blockNumber);

  const decodedData = coder.decode(
    ['uint256', 'uint256', 'uint256'],
    data.returnData[0],
  );

  const totalETHBalance = BigInt(decodedData[1].toString());
  const totalETHXSupply = BigInt(decodedData[2].toString());
  const ETHxToETHRateFixed = (totalETHBalance * DECIMALS) / totalETHXSupply;

  return {
    ETHxToETHRateFixed,
  };
}
