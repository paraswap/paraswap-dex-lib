import { BytesLike } from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { extractSuccessAndValue, generalDecoder } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import { DecimalInfo, TokenInfo, TokenState } from './types';

export function tokenInfoDecoder(
  result: MultiResult<BytesLike> | BytesLike,
): TokenInfo {
  return generalDecoder(result, ['uint192', 'uint16'], undefined, value => ({
    reserve: value[0].toBigInt(),
    feeRate: value[1].toBigInt(),
  }));
}

export function decimalInfoDecoder(
  result: MultiResult<BytesLike> | BytesLike,
): DecimalInfo {
  return generalDecoder(
    result,
    ['tuple(uint64 priceDec, uint64 quoteDec, uint64 baseDec)'],
    undefined,
    value => ({
      priceDec: value[0].priceDec.toBigInt(),
      quoteDec: value[0].quoteDec.toBigInt(),
      baseDec: value[0].baseDec.toBigInt(),
    }),
  );
}

// This is state from WooOracleV2 contract
export function stateDecoder(
  result: MultiResult<BytesLike> | BytesLike,
): TokenState {
  return generalDecoder(
    result,
    ['tuple(uint128 price, uint64 spread, uint64 coeff, bool woFeasible)'],
    undefined,
    value => ({
      price: value[0].toBigInt(),
      spread: value[0].toBigInt(),
      coeff: value[0].toBigInt(),
    }),
  );
}
