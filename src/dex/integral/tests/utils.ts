/* eslint-disable no-console */
import { ethers } from 'ethers';
import { assert } from 'ts-essentials';

export const sleep = (time: number) =>
  new Promise(resolve => {
    setTimeout(resolve, time);
  });

export const generateDeployBytecode = (
  testContractProjectRootPath: string | undefined,
  testContractName: string | undefined,
  testContractConfigFileName: string | undefined,
  testContractRelativePath: string | undefined,
  testContractDeployArgs: string | undefined,
  testContractType: string | undefined,
): string => {
  if (
    !testContractProjectRootPath ||
    !testContractName ||
    !testContractConfigFileName ||
    !testContractRelativePath ||
    !testContractDeployArgs ||
    !testContractType
  ) {
    return '';
  }

  const artifactJsonPath = `${testContractProjectRootPath}/artifacts/${testContractName}.json`;
  const configJsonPath = `${testContractProjectRootPath}/config/${testContractConfigFileName}.json`;
  const fieldsToPickFromConfig = testContractDeployArgs.split(',');

  const artifact = require(artifactJsonPath) as {
    abi: ethers.ContractInterface;
    bytecode: string;
  };
  // I don't want to type this testing thing. If something is wrong, I will just throw
  const config = require(configJsonPath) as any;
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode);

  const args = fieldsToPickFromConfig.map(f => {
    const value = config[f];
    if (value === undefined) {
      console.log(
        `Field ${f} is not defined in configJsonPath=${configJsonPath}. Using value as it is`,
      );
      return f;
    }
    return value;
  });

  const deployedBytecode = factory.getDeployTransaction(...args).data;

  assert(deployedBytecode !== undefined, 'deployedBytecode is undefined');

  return deployedBytecode.toString();
};
