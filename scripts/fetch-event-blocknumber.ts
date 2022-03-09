import dotenv from 'dotenv';
dotenv.config();

import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';
import VaultABI from '../src/abi/balancer-v2/vault.json';
import { ProviderURL, Network } from '../src/constants';
import { Address } from '../src/types';

// This is a helper script to fetch blockNumbers where a certain
// event was released by a certain contract
async function getBlockNumbersForEvents(
  contractAddress: Address,
  contractABI: any,
  eventNames: string[],
  blocksToCheck: number,
  provider: JsonRpcProvider,
) {
  const blockNumber = await provider.getBlockNumber();
  const contract = new Contract(contractAddress, contractABI, provider);
  for (let eventName of eventNames) {
    const logs = await contract.queryFilter(
      contract.filters[eventName](),
      blockNumber - blocksToCheck,
    );
    console.log(
      eventName,
      logs.map((val: any) => val.blockNumber),
    );
  }
}

const network = Network.MAINNET;
const eventNames = ['Swap', 'PoolBalanceChanged'];
const vaultAddress = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
const provider = new JsonRpcProvider(ProviderURL[network]);

getBlockNumbersForEvents(vaultAddress, VaultABI, eventNames, 3000, provider);
