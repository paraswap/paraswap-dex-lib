import { Token } from '../../types';
import { Network } from '../../constants';

import { IdleToken } from './types';
import { IDexHelper } from '../../dex-helper';
import CDO_ABI from '../../abi/idle-dao/idle-cdo.json';
import { AbiItem } from 'web3-utils';

const poolsByTokenAddress: {
  [network: number]: { [address: string]: IdleToken[] };
} = {};

const TokensByAddress: { [network: number]: { [address: string]: IdleToken } } =
  {};

export const getPoolsByTokenAddress = (
  network: number,
  address: string,
): IdleToken[] => {
  return poolsByTokenAddress[network]?.[address] || [];
};

// return null if the pair does not exists otherwise return the idleToken
export function getIdleTokenIfIdleDaoPair(
  network: number,
  src: Token,
  dst: Token,
): IdleToken | null {
  const srcAddr = src.address.toLowerCase();
  const dstAddr = dst.address.toLowerCase();

  if (srcAddr === dstAddr) {
    return null;
  }

  const _src = TokensByAddress[network][srcAddr];
  const _dst = TokensByAddress[network][dstAddr];

  if (_src && _src.address.toLowerCase() == dstAddr) {
    return _src;
  }

  if (_dst && _dst.address.toLowerCase() == srcAddr) {
    return _dst;
  }

  return null;
}

export function getTokenFromIdleToken(idleToken: IdleToken): Token {
  return {
    address: idleToken.idleAddress,
    decimals: idleToken.idleDecimals,
    symbol: idleToken.idleSymbol,
  };
}

export function getIdleTokenByAddress(
  network: Network,
  address: string,
): IdleToken | undefined {
  return TokensByAddress[network]?.[address];
}

export function setTokensOnNetwork(
  network: Network,
  tokens: IdleToken[],
  dexHelper: IDexHelper,
): any {
  for (let token of tokens) {
    token.address = token.address.toLowerCase();
    token.idleAddress = token.idleAddress.toLowerCase();

    if (TokensByAddress[network] === undefined) {
      TokensByAddress[network] = {};
    }

    if (poolsByTokenAddress[network] === undefined) {
      poolsByTokenAddress[network] = {};
    }

    if (poolsByTokenAddress[network][token.address] === undefined) {
      poolsByTokenAddress[network][token.address] = [];
    }

    const tokenWithContract: IdleToken = {
      ...token,
      cdoContract: new dexHelper.web3Provider.eth.Contract(
        CDO_ABI as AbiItem[],
        token.cdoAddress,
      ),
    };
    TokensByAddress[network][token.idleAddress] = tokenWithContract;
    TokensByAddress[network][token.address] = tokenWithContract;
    poolsByTokenAddress[network][token.address].push(token);
  }

  return TokensByAddress[network];
}
