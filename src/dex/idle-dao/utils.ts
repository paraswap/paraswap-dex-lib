import { CustomCdos, AUTH_TOKEN_ENCODED, endpoints } from './config';
import { BytesLike } from 'ethers';
import BigNumber from 'bignumber.js';
import { defaultAbiCoder, Interface } from '@ethersproject/abi';
import {
  extractSuccessAndValue,
  stringDecode,
  addressDecode,
  uint8ToNumber,
} from '../../lib/decoders';
import {
  MultiCallParams,
  MultiResult,
  MultiWrapper,
} from '../../lib/multi-wrapper';
import Web3 from 'web3';
import { IdleToken, TrancheToken } from './types';
import FACTORY_ABI from '../../abi/idle-dao/idle-cdo-factory.json';
import axios from 'axios';
import { Network } from '../../constants';

export const BNify = (s: any): BigNumber =>
  new BigNumber(typeof s === 'object' ? s : String(s));

async function _getIdleTokenSymbols(
  blockNumber: number,
  idleTokens: string[],
  erc20Interface: Interface,
  multiWrapper: MultiWrapper,
): Promise<any> {
  let calls: MultiCallParams<any>[] = [];

  for (const idleAddress of idleTokens) {
    calls.push({
      target: idleAddress,
      callData: erc20Interface.encodeFunctionData('symbol', []),
      decodeFunction: (result: MultiResult<BytesLike> | BytesLike): any => {
        return {
          idleAddress,
          idleSymbol: stringDecode(result),
        };
      },
    });
  }
  const results = await multiWrapper.aggregate<any>(calls, blockNumber);

  return results.reduce((output, item) => {
    return {
      ...output,
      [item.idleAddress]: item.idleSymbol,
    };
  }, {});
}

async function _getIdleTokenDecimals(
  blockNumber: number,
  underlyingTokens: string[],
  erc20Interface: Interface,
  multiWrapper: MultiWrapper,
): Promise<any> {
  let calls: MultiCallParams<any>[] = [];

  for (const address of underlyingTokens) {
    calls.push({
      target: address,
      callData: erc20Interface.encodeFunctionData('decimals', []),
      decodeFunction: (result: MultiResult<BytesLike> | BytesLike): any => {
        return {
          address,
          decimals: uint8ToNumber(result),
        };
      },
    });
  }
  const results = await multiWrapper.aggregate<any>(calls, blockNumber);

  return results.reduce((output, item) => {
    return {
      ...output,
      [item.address]: item.decimals,
    };
  }, {});
}

const getDataWithAuth = async (
  endpoint: string,
  token: string,
  error_callback?: Function,
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const data = await axios.post(endpoint, {}, config).catch(err => {
    if (typeof error_callback === 'function') {
      error_callback(err);
    }
  });
  return data?.data;
};

export const fetchTokenList_api = async (
  network: Network,
  web3Provider: Web3,
  blockNumber: number,
  fromBlock: number,
  factoryAddress: string,
  cdoInterface: Interface,
  erc20Interface: Interface,
  multiWrapper: MultiWrapper,
): Promise<IdleToken[]> => {
  const AUTH_TOKEN_DECODED = atob(AUTH_TOKEN_ENCODED);
  const data = await getDataWithAuth(endpoints[network], AUTH_TOKEN_DECODED);
  if (!data) return [];

  const deployedContract = data
    .filter((d: any) => !!d.cdoAddress)
    .map((d: any) => d.cdoAddress);

  const calls = deployedContract.reduce(
    (calls: MultiCallParams<any>[], cdoAddress: string) => {
      calls.push({
        target: cdoAddress,
        callData: cdoInterface.encodeFunctionData('AATranche', []),
        decodeFunction: (
          result: MultiResult<BytesLike> | BytesLike,
        ): TrancheToken => {
          return {
            cdoAddress,
            tokenType: 'AA',
            idleAddress: addressDecode(result),
          };
        },
      });

      calls.push({
        target: cdoAddress,
        callData: cdoInterface.encodeFunctionData('BBTranche', []),
        decodeFunction: (
          result: MultiResult<BytesLike> | BytesLike,
        ): TrancheToken => {
          return {
            cdoAddress,
            tokenType: 'BB',
            idleAddress: addressDecode(result),
          };
        },
      });

      calls.push({
        target: cdoAddress,
        callData: cdoInterface.encodeFunctionData('token', []),
        decodeFunction: (result: MultiResult<BytesLike> | BytesLike): any => {
          return {
            cdoAddress,
            address: addressDecode(result),
          };
        },
      });

      return calls;
    },
    [],
  );

  const results = await multiWrapper.aggregate<Record<string, string>>(
    calls,
    blockNumber,
  );

  const cdosUnderlying: Record<string, string> = results.reduce(
    (cdosUnderlying, result: any) => {
      if (!result.address) return cdosUnderlying;
      return {
        ...cdosUnderlying,
        [result.cdoAddress]: result.address,
      };
    },
    {},
  );

  const idleTokenSymbolsList = await _getIdleTokenSymbols(
    blockNumber,
    results
      .filter(result => !!result.tokenType)
      .map(result => result.idleAddress),
    erc20Interface,
    multiWrapper,
  );

  const idleTokenDecimals = await _getIdleTokenDecimals(
    blockNumber,
    results.filter(result => !result.tokenType).map(result => result.address),
    erc20Interface,
    multiWrapper,
  );

  // console.log('idleTokenDecimals', idleTokenDecimals)
  // console.log('cdosUnderlying', cdosUnderlying)

  const output: IdleToken[] = [];
  for (const result of results) {
    if (result.tokenType) {
      const idleToken: IdleToken = {
        decimals: 18,
        blockNumber: 0,
        cdoAddress: result.cdoAddress,
        idleAddress: result.idleAddress,
        address: cdosUnderlying[result.cdoAddress],
        idleSymbol: idleTokenSymbolsList[result.idleAddress],
        tokenType: result.tokenType as IdleToken['tokenType'],
      };
      output.push(idleToken);
    }
  }

  // console.log('tokenList', output)
  return output;
};

export const fetchTokenList_chain = async (
  web3Provider: Web3,
  blockNumber: number,
  fromBlock: number,
  factoryAddress: string,
  cdoInterface: Interface,
  erc20Interface: Interface,
  multiWrapper: MultiWrapper,
): Promise<IdleToken[]> => {
  const factoryContract = new web3Provider.eth.Contract(
    FACTORY_ABI as any,
    factoryAddress,
  );

  // Take all deployed CDOs from factory
  const deployedContracts = await factoryContract.getPastEvents('CDODeployed', {
    fromBlock,
    toBlock: blockNumber,
    filter: {
      topics: [
        '0xcfed305fd6d1aebca7d8ef4978868c2fe10910ee8dd94c3be048a9591f37429f',
      ],
    },
  });

  const cdoBlocks: Record<string, number> = deployedContracts.reduce(
    (cdoBlocks, deployedContract: any) => {
      return {
        ...cdoBlocks,
        [deployedContract.returnValues.proxy]: deployedContract.blockNumber,
      };
    },
    CustomCdos,
  );

  const calls = Object.keys(cdoBlocks).reduce(
    (calls: MultiCallParams<any>[], cdoAddress: string) => {
      calls.push({
        target: cdoAddress,
        callData: cdoInterface.encodeFunctionData('AATranche', []),
        decodeFunction: (
          result: MultiResult<BytesLike> | BytesLike,
        ): TrancheToken => {
          return {
            cdoAddress,
            tokenType: 'AA',
            idleAddress: addressDecode(result),
          };
        },
      });

      calls.push({
        target: cdoAddress,
        callData: cdoInterface.encodeFunctionData('BBTranche', []),
        decodeFunction: (
          result: MultiResult<BytesLike> | BytesLike,
        ): TrancheToken => {
          return {
            cdoAddress,
            tokenType: 'BB',
            idleAddress: addressDecode(result),
          };
        },
      });

      calls.push({
        target: cdoAddress,
        callData: cdoInterface.encodeFunctionData('token', []),
        decodeFunction: (result: MultiResult<BytesLike> | BytesLike): any => {
          return {
            cdoAddress,
            address: addressDecode(result),
          };
        },
      });

      return calls;
    },
    [],
  );

  const results = await multiWrapper.aggregate<Record<string, string>>(
    calls,
    blockNumber,
  );

  const cdosUnderlying: Record<string, string> = results.reduce(
    (cdosUnderlying, result: any) => {
      if (!result.address) return cdosUnderlying;
      return {
        ...cdosUnderlying,
        [result.cdoAddress]: result.address,
      };
    },
    {},
  );

  const idleTokenSymbolsList = await _getIdleTokenSymbols(
    blockNumber,
    results
      .filter(result => !!result.tokenType)
      .map(result => result.idleAddress),
    erc20Interface,
    multiWrapper,
  );

  const idleTokenDecimals = await _getIdleTokenDecimals(
    blockNumber,
    results.filter(result => !result.tokenType).map(result => result.address),
    erc20Interface,
    multiWrapper,
  );

  // console.log('idleTokenDecimals', idleTokenDecimals)
  // console.log('cdosUnderlying', cdosUnderlying)

  const output: IdleToken[] = [];
  for (const result of results) {
    if (result.tokenType) {
      const idleToken: IdleToken = {
        decimals: 18,
        cdoAddress: result.cdoAddress,
        idleAddress: result.idleAddress,
        blockNumber: cdoBlocks[result.cdoAddress],
        address: cdosUnderlying[result.cdoAddress],
        idleSymbol: idleTokenSymbolsList[result.idleAddress],
        tokenType: result.tokenType as IdleToken['tokenType'],
      };
      output.push(idleToken);
    }
  }

  // console.log('tokenList', output)
  return output;
};
