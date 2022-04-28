import dotenv from 'dotenv';
dotenv.config();

import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider, Provider } from '@ethersproject/providers';
import ABI from '../src/abi/balancer-v2/vault.json';
import { ProviderURL, Network } from '../src/constants';
import { Address } from '../src/types';

// This is a helper script to fetch blockNumbers where a certain
// event was released by a certain contract
async function getBlockNumbersForEvents(
  contractAddress: Address,
  contractABI: any,
  eventNames: string[],
  blocksBack: number,
  blocksToCheck: number,
  provider: Provider,
) {
  const blockNumber = (await provider.getBlockNumber()) - blocksBack;
  const contract = new Contract(contractAddress, contractABI, provider);
  for (let eventName of eventNames) {
    console.log(
      eventName,
      'topic',
      contract.interface.getEventTopic(eventName),
    );
    const logs = await contract.queryFilter(
      contract.filters[eventName](),
      blockNumber - blocksToCheck,
      blockNumber,
    );
    console.log(
      eventName,
      logs.map((val: any) => val.blockNumber),
    );
  }
}

const network = Network.MAINNET;
const eventNames = ['Swap', 'PoolBalanceChanged'];
const address = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
const provider = new StaticJsonRpcProvider(ProviderURL[network], network);

getBlockNumbersForEvents(address, ABI, eventNames, 0, 2000, provider);
