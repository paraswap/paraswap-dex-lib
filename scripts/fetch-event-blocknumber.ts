import dotenv from 'dotenv';
dotenv.config();

import { Contract } from '@ethersproject/contracts';
import { StaticJsonRpcProvider, Provider } from '@ethersproject/providers';
import { Network } from '../src/constants';
import { Address } from '../src/types';
import { generateConfig } from '../src/config';
// TODO: Import correct ABI
import ABI from '../src/abi/erc20.json';
import ReaderABI from '../src/abi/minerva/reader.json';
import FastPriceFeedABI from '../src/abi/minerva/fast-price-feed.json';
import FastPriceEventABI from '../src/abi/minerva/fast-price-events.json';
import VaultPriceFeedABI from '../src/abi/minerva/vault-price-feed.json';
import VaultABI from '../src/abi/minerva/vault.json';

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
const network = Network.OPTIMISM;
const eventNames = ['Transfer'];
const address = '0x6CdC00A448fB093575f82279c85fc99db00A74A4';
const provider = new StaticJsonRpcProvider(
  generateConfig(network).privateHttpProvider,
  network,
);

getBlockNumbersForEvents(address, ABI, eventNames, 0, 2000, provider);
