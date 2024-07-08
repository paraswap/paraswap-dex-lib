// import {
//   IStaticATokenFactory_ABI,
//   IStaticATokenLM_ABI,
// } from '@bgd-labs/aave-address-book';
import { Interface } from '@ethersproject/abi';
import Web3 from 'web3';
import { MultiCallParams, MultiWrapper } from '../../lib/multi-wrapper';
import { stringDecode, uint8ToNumber, addressDecode } from '../../lib/decoders';
import { StataToken } from './types';
import FactoryABI from '../../abi/aavev3stata/Factory.json';
import TokenABI from '../../abi/aavev3stata/Token.json';
import { AbiItem } from 'web3-utils';

// const stataInterface = new Interface(IStaticATokenLM_ABI);
const stataInterface = new Interface(TokenABI);

async function getTokenMetaData(
  stataTokens: string[],
  multiWrapper: MultiWrapper,
  blockNumber?: number,
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
  for (let i = 0, x = 0; i < stataTokens.length; ++i, x += 4) {
    tokenList.push({
      address: stataTokens[i].toLowerCase(),
      stataSymbol: results[x] as string,
      decimals: results[x + 1] as number,
      underlying: (results[x + 2] as string).toLowerCase(),
      underlyingAToken: (results[x + 3] as string).toLowerCase(),
    });
  }
  return tokenList;
}

export const fetchTokenList = async (
  web3Provider: Web3,
  factoryAddress: string,
  multiWrapper: MultiWrapper,
  blockNumber?: number,
): Promise<StataToken[]> => {
  let factoryContract = new web3Provider.eth.Contract(
    FactoryABI as AbiItem[],
    // IStaticATokenFactory_ABI as any,
    factoryAddress,
  );

  let stataList: string[] = await factoryContract.methods
    .getStaticATokens()
    .call();

  return getTokenMetaData(stataList, multiWrapper, blockNumber);
};
