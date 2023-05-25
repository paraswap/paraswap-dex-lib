import dotenv from 'dotenv';
dotenv.config();

import { Contract } from '@ethersproject/contracts';
import { Network } from '../src/constants';
import { Address } from '../src/types';
// TODO: Import correct ABI
import ABI from '../src/abi/erc20.json';
import { Provider } from '@ethersproject/providers';
import { getRpcProvider } from '../src/web3-provider';

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

// TODO: Set your values here
const network = Network.AVALANCHE;
const eventNames = ['Transfer'];
const address = '0xc0253c3cc6aa5ab407b5795a04c28fb063273894';
const provider = getRpcProvider(network);

getBlockNumbersForEvents(address, ABI, eventNames, 0, 2000, provider);
