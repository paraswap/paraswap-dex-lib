import { BytesLike } from 'ethers';
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

export const decodeIdleTokenFromReserveData = (
  result: MultiResult<BytesLike> | BytesLike,
): string => {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  if (!isSuccess || toDecode === '0x') {
    throw new Error(
      'Could not extract value from struct DataTypes.ReserveData.',
    );
  }

  const decoded = defaultAbiCoder.decode(
    [
      'tuple(uint256) configuration',
      'uint128 liquidityIndex',
      'uint128 currentLiquidityRate',
      'uint128 variableBorrowIndex',
      'uint128 currentVariableBorrowRate',
      'uint128 currentStableBorrowRate',
      'uint40 lastUpdateTimestamp',
      'uint16 id',
      'address aTokenAddress',
      'address stableDebtTokenAddress',
      'address variableDebtTokenAddress',
      'address interestRateStrategyAddress',
      'uint128 accruedToTreasury',
      'uint128 unbacked',
      'uint128 isolationModeTotalDebt',
    ],
    toDecode,
  );

  return decoded.aTokenAddress.toLowerCase();
};

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

export const fetchTokenList = async (
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

  // console.log('deployedContracts', deployedContracts);

  const cdos: string[] = deployedContracts.map(
    (deployedContract: any) => deployedContract.returnValues.proxy,
  );

  const calls = cdos.reduce(
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

  // console.log('idleTokenSymbolsList', idleTokenSymbolsList)
  // console.log('cdosUnderlying', cdosUnderlying)

  const output: IdleToken[] = [];
  for (const result of results) {
    if (result.tokenType) {
      const idleToken: IdleToken = {
        decimals: 18,
        cdoAddress: result.cdoAddress,
        idleAddress: result.idleAddress,
        address: cdosUnderlying[result.cdoAddress],
        idleSymbol: idleTokenSymbolsList[result.idleAddress],
        tokenType: result.tokenType as IdleToken['tokenType'],
      };
      output.push(idleToken);
    }
  }

  // console.log('output', output)
  return output;
};
