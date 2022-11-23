import { ethers } from 'ethers';
import { Address, Token } from '../../types';
import { getBalances } from '../../lib/tokens/balancer-fetcher';
import {
  AssetType,
  DEFAULT_ID_ERC20,
  DEFAULT_ID_ERC20_AS_STRING,
} from '../../lib/tokens/types';
import { calculateOrderHash } from '../paraswap-limit-orders/utils';
import { AugustusOrderWithStringAndSignature, RFQPayload } from './types';
import { MultiWrapper } from '../../lib/multi-wrapper';
import { Network } from '../../constants';

export const checkOrder = async (
  network: Network,
  augustusRFQAddress: Address,
  multiWrapper: MultiWrapper,
  order: AugustusOrderWithStringAndSignature,
) => {
  const balances = await getBalances(multiWrapper, [
    {
      owner: order.maker,
      asset: order.makerAsset,
      assetType: AssetType.ERC20,
      ids: [
        {
          id: DEFAULT_ID_ERC20,
          spenders: [augustusRFQAddress],
        },
      ],
    },
  ]);

  const balance = balances[0];

  const makerAmountBigInt = BigInt(order.makerAmount);
  const makerBalance = BigInt(balance.amounts[DEFAULT_ID_ERC20_AS_STRING]);
  if (makerBalance <= makerAmountBigInt) {
    throw new Error(
      `maker does not have enough balance (request ${makerAmountBigInt} value ${makerBalance}`,
    );
  }

  const takerBalance = BigInt(
    balance.allowances[DEFAULT_ID_ERC20_AS_STRING][augustusRFQAddress],
  );
  if (takerBalance <= makerAmountBigInt) {
    throw new Error(
      `maker does not have enough allowance (request ${makerAmountBigInt} value ${takerBalance}`,
    );
  }
  const hash = calculateOrderHash(network, order, augustusRFQAddress);

  const recovered = ethers.utils
    .recoverAddress(hash, order.signature)
    .toLowerCase();

  if (recovered !== order.maker.toLowerCase()) {
    throw new Error(`signature is invalid`);
  }
};
