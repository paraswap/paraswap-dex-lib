import { _TypedDataEncoder } from 'ethers/lib/utils';
import { Network } from '../../constants';
import { toUnixTimestamp } from '../../utils';
import { BUILD_ORDER_CONSTANTS } from './constant';
import { AugustusOrderWithString } from './types';

export function buildOrderData(
  chainId: Network,
  params: AugustusOrderWithString,
  contractAddress: string,
) {
  const domain = {
    name: BUILD_ORDER_CONSTANTS.NAME,
    version: BUILD_ORDER_CONSTANTS.VERSION,
    chainId: chainId,
    verifyingContract: contractAddress,
  };
  const types = { Order: BUILD_ORDER_CONSTANTS.ORDER_INTERFACE };
  const order = {
    nonceAndMeta: params.nonceAndMeta,
    expiry: params.expiry ? toUnixTimestamp(new Date(params.expiry)) : 0,
    makerAsset: params.makerAsset,
    takerAsset: params.takerAsset,
    maker: params.maker,
    taker: params.taker,
    makerAmount: params.makerAmount,
    takerAmount: params.takerAmount,
  };

  return { domain, types, order };
}

export function calculateOrderHash(
  chainId: Network,
  params: AugustusOrderWithString,
  contractAddress: string,
) {
  const { domain, types, order } = buildOrderData(
    chainId,
    params,
    contractAddress,
  );
  return _TypedDataEncoder.hash(domain, types, order);
}
