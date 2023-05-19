import dotenv from 'dotenv';
dotenv.config();

import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider, Provider } from '@ethersproject/providers';
import { Network } from '../src/constants';
import { Address } from '../src/types';
import { generateConfig } from '../src/config';
// TODO: Import correct ABI
import ABI from '../src/abi/dfyn-v2/DfynV2Pool.abi.json';

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
const network = Network.POLYGON;
const eventNames = ['Swap','Burn','Mint','Collect','CreateLimitOrder','ClaimLimitOrder','CancelLimitOrder','SwapFeeUpdated'];
const address = '0x1a7c22A039dFbD3950F3B5B22aeA098DD25f8e94';
const provider = new StaticJsonRpcProvider(
  generateConfig(network).privateHttpProvider,
  network,
);

getBlockNumbersForEvents(address, ABI, eventNames, 100000, 10000, provider);
//,'Burn','Mint','Collect','CreateLimitOrder','ClaimLimitOrder','CancelLimitOrder','SwapFeeUpdated'