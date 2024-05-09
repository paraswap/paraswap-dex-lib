/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Network } from '../../../constants';
import { DummyDexHelper } from '../../../dex-helper';
import { SDaiPoolState } from '../types';
import { BlockHeader } from 'web3-eth';
import { ethers } from 'ethers';
import { SDai } from '../sdai';
import { SDaiConfig } from '../config';
import { getOnChainState } from '../utils';
import { Interface } from '@ethersproject/abi';
import PotAbi from '../../../abi/maker-psm/pot.json';
import multiABIV2 from '../../../abi/multi-v2.json';
import Web3 from 'web3';

const web3Provider = new Web3('');
const multiContract = new web3Provider.eth.Contract(
  multiABIV2 as any,
  '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
);
const network = Network.MAINNET;
const dexKey = 'SDai';

const { potAddress } = SDaiConfig[dexKey][network];
const blockHeaders: Record<number, BlockHeader> = {};

const dexHelper = new DummyDexHelper(network);
const logger = dexHelper.getLogger(dexKey);

function preprocessField(value: any): string {
  if (
    typeof value === 'bigint' ||
    typeof value === 'number' ||
    ethers.BigNumber.isBigNumber(value)
  ) {
    return value.toString();
  }
  return value;
}

function compareAndLogDifferences<T extends object, Y extends object>(
  obj1: T,
  obj2: Y,
  keyNames: Array<keyof T & keyof Y>,
  checkEachKey = false,
) {
  let isValid = true;
  let keys = keyNames;

  if (checkEachKey) {
    // find common keys
    const keys1 = Object.keys(obj1);
    const keys2 = new Set(Object.keys(obj2));
    keys = keys1.filter(key => keys2.has(key)) as Array<keyof T & keyof Y>;
  }

  for (let fieldName of keys) {
    const value1 = preprocessField(obj1[fieldName]);
    const value2 = preprocessField(obj2[fieldName]);

    if (value1 !== value2) {
      console.log(
        `${fieldName.toString()} mismatch: actual: ${value1} vs pool: ${value2}`,
      );
      isValid = false;
    }
  }

  return isValid;
}

async function isPoolStateEqualToReal(
  state: SDaiPoolState,
  blockNumber: number,
) {
  const { rho, chi, dsr, live } = await getOnChainState(
    multiContract,
    potAddress,
    new Interface(PotAbi),
    blockNumber,
  );

  const isValidState = compareAndLogDifferences(
    state,
    { rho, chi, dsr, live },
    ['rho', 'chi', 'dsr', 'dsr'],
  );

  return isValidState;
}

async function checkPoolStateForBlockRange(
  startBlockNumber: number,
  endBlockNumber: number,
): Promise<boolean> {
  const network = Network.MAINNET;
  const dexKey = 'SDai';
  const dexHelper = new DummyDexHelper(network);

  const sdai = new SDai(network, dexKey, dexHelper);
  const pool = await sdai.eventPool;

  const logsToDispatch = await dexHelper.provider.getLogs({
    fromBlock: startBlockNumber,
    toBlock: endBlockNumber,
    address: potAddress,
  });

  console.log(logsToDispatch.length);

  // group logs by block number
  const logsByBlockNumber: Record<number, any[]> = {};
  for (let log of logsToDispatch) {
    if (!logsByBlockNumber[log.blockNumber]) {
      logsByBlockNumber[log.blockNumber] = [];
    }
    logsByBlockNumber[log.blockNumber].push(log);
  }

  const sortedBlocks = Object.keys(logsByBlockNumber)
    .map(Number)
    .sort((a, b) => Number(a) - Number(b));

  for (let blockNumber of sortedBlocks) {
    if (!blockHeaders[blockNumber]) {
      blockHeaders[blockNumber] = await dexHelper.web3Provider.eth.getBlock(
        blockNumber,
      );
    }

    await pool?.update(logsByBlockNumber[blockNumber], {
      [blockNumber]: blockHeaders[blockNumber],
    });
  }

  const state = pool?.getState(startBlockNumber) as SDaiPoolState;
  return isPoolStateEqualToReal(state, endBlockNumber);
}

async function main() {
  // use findBreakingBlock to find the block where the state is broken
  // console.log(await findBreakingBlock(startBlockNumber, endBlockNumber));
  // previously broken block 150502863
  console.log(await checkPoolStateForBlockRange(8928160, 19199247));
}

main()
  .then(() => console.log('Done'))
  .catch(e => console.error(e));
