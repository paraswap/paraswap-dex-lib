/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import Web3 from 'web3';
import { BlockHeader } from 'web3-eth';
import { Network } from '../../../constants';
import { DummyDexHelper } from '../../../dex-helper';
import { SolidlyV3Config } from './../config';
import { SolidlyV3 } from '../solidly-v3';

const dex = 'SolidlyV3';
const factory = SolidlyV3Config[dex][Network.MAINNET].factory;
const blockHeaders: Record<number, BlockHeader> = {};

async function checkForPoolEvents(
  startBlockNumber: number,
  endBlockNumber: number,
): Promise<boolean> {
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);

  const solidlyV3 = new SolidlyV3(network, dex, dexHelper);
  await solidlyV3.initializePricing(startBlockNumber);

  const logsToDispatch = await dexHelper.provider.getLogs({
    fromBlock: startBlockNumber,
    toBlock: endBlockNumber,
    address: factory,
  });

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

    await solidlyV3.factory?.update(logsByBlockNumber[blockNumber], {
      [blockNumber]: blockHeaders[blockNumber],
    });
  }

  return true;
}

async function main() {
  // event for https://etherscan.io/tx/0x2bef7c17f3f775525f076aeb20567ee25eb820e92aa8422fbfe4bed652fd2bd3
  checkForPoolEvents(18758010, 18758019);
}

main()
  .then(() => console.log('Done'))
  .catch(e => console.error(e));
