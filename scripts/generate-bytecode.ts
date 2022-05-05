import { ethers } from 'ethers';

const artifact = {};

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode);

console.log(factory.getDeployTransaction());
