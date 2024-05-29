import {
  IStaticATokenFactory_ABI,
  IStaticATokenLM_ABI,
} from '@bgd-labs/aave-address-book';
import { Interface } from '@ethersproject/abi';
import Web3 from 'web3';
import { MultiCallParams, MultiWrapper } from '../../lib/multi-wrapper';
import { stringDecode, uint8ToNumber, addressDecode } from '../../lib/decoders';
import { StataToken } from './types';

const stataInterface = new Interface(IStaticATokenLM_ABI);

async function getTokenMetaData(
  blockNumber: number,
  stataTokens: string[],
  multiWrapper: MultiWrapper,
): Promise<StataToken[]> {
  const calls: MultiCallParams<any>[] = stataTokens
    .map(token => {
      return [
        {
          target: token,
          callData: stataInterface.encodeFunctionData('symbol'),
          decodeFunction: stringDecode,
        },
        {
          target: token,
          callData: stataInterface.encodeFunctionData('decimals'),
          decodeFunction: uint8ToNumber,
        },
        {
          target: token,
          callData: stataInterface.encodeFunctionData('asset'),
          decodeFunction: addressDecode,
        },
        {
          target: token,
          callData: stataInterface.encodeFunctionData('aToken'),
          decodeFunction: addressDecode,
        },
      ];
    })
    .flat();

  const results = await multiWrapper.aggregate<string | number>(
    calls,
    blockNumber,
  );

  let tokenList: StataToken[] = [];
  for (let i = 0; i < results.length; i += 4) {
    tokenList.push({
      address: stataTokens[i],
      stataSymbol: results[i] as string,
      decimals: results[i + 1] as number,
      underlying: results[i + 2] as string,
      underlyingAToken: results[i + 3] as string,
    });
  }
  return tokenList;
}

export const fetchTokenList = async (
  web3Provider: Web3,
  blockNumber: number,
  factoryAddress: string,
  multiWrapper: MultiWrapper,
): Promise<any> => {
  let factoryContract = new web3Provider.eth.Contract(
    IStaticATokenFactory_ABI as any,
    factoryAddress,
  );
  let stataList = await factoryContract.methods.getStaticATokens().call();

  return getTokenMetaData(blockNumber, stataList, multiWrapper);
};
