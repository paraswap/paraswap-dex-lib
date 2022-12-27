import dotenv from 'dotenv';
dotenv.config();

import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import MultiAbi from '../src/abi/multi-v2.json';
import { generateConfig } from '../src/config';
import { Network } from '../src/constants';
import { blockAndAggregate } from '../src/utils';
import { getBalanceERC20 } from '../src/lib/tokens/utils';

describe('MultiCall with blockNumber', () => {
  const config = generateConfig(Network.MAINNET);

  const web3 = new Web3(config.privateHttpProvider);
  const multiContract = new web3.eth.Contract(
    MultiAbi as AbiItem[],
    config.multicallV2Address,
  );

  it('MultiCall with blockNumber', async () => {
    const res = await blockAndAggregate(multiContract, [
      {
        target: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        callData: getBalanceERC20('0x05182e579fdfcf69e4390c3411d8fea1fb6467cf'),
      },
      {
        target: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        callData: getBalanceERC20('0x05182e579fdfcf69e4390c3411d8fea1fb6467cf'),
      },
    ]);
  });
});
