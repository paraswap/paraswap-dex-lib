import * as dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { Address } from 'paraswap-core';
import { Network, NULL_ADDRESS, ProviderURL } from '../src/constants';
import { ParaswapLimitOrdersConfig } from '../src/dex/paraswap-limit-orders/config';

const network = Network.ROPSTEN;
const provider = ethers.getDefaultProvider(ProviderURL[network]);
const makerPK = process.env.MAKER_PK || '';
const taker = '0xCf8C4a46816b146Ed613d23f6D22e1711915d653';

const maker = new ethers.Wallet(makerPK, provider);

const dexKey = 'ParaswapLimitOrders';
const rfqAddress =
  ParaswapLimitOrdersConfig[dexKey][network].rfqAddress.toLowerCase();

const wethAddress = '0xc778417e063141139fce010982780140aa0cd5ab';
const daiAddress = '0xad6d458402f60fd3bd25163575031acdce07538d';
const name = 'AUGUSTUS RFQ';
const version = '1';

const OrderSchema = [
  { name: 'nonceAndMeta', type: 'uint256' },
  { name: 'expiry', type: 'uint128' },
  { name: 'makerAsset', type: 'address' },
  { name: 'takerAsset', type: 'address' },
  { name: 'maker', type: 'address' },
  { name: 'taker', type: 'address' },
  { name: 'makerAmount', type: 'uint256' },
  { name: 'takerAmount', type: 'uint256' },
];

function getRandomInt(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function buildOrderData(
  chainId: number,
  verifyingContract: Address,
  nonceAndMeta: string,
  expiry: number,
  makerAsset: Address,
  takerAsset: Address,
  makerAmount: string,
  takerAmount: string,
  maker: Address,
  taker: Address = NULL_ADDRESS,
) {
  const order = {
    nonceAndMeta,
    expiry,
    makerAsset,
    takerAsset,
    maker,
    taker,
    makerAmount,
    takerAmount,
  };
  return {
    types: { Order: OrderSchema },
    domain: { name, version, chainId, verifyingContract },
    order,
  };
}

async function createOrder(makerAmount: string, takerAmount: string) {
  const nonceAndMeta = (BigInt(getRandomInt()) << BigInt(160)).toString(10);

  const { order, domain, types } = buildOrderData(
    network,
    rfqAddress,
    nonceAndMeta,
    0,
    daiAddress,
    wethAddress,
    makerAmount,
    takerAmount,
    maker.address,
  );

  console.log('lo', domain, types, order);
  const signature = await maker._signTypedData(domain, types, order);

  const respOrder = {
    ...order,
    nonceAndMeta: `${order.nonceAndMeta}`,
    makerAmount: order.makerAmount.toString(),
    takerAmount: order.takerAmount.toString(),
    makerAsset: order.makerAsset.toString(),
    takerAsset: order.takerAsset.toString(),
    signature: signature,
  };
  console.log(JSON.stringify(respOrder));
}

(async function main() {
  // These are the orders which are used in paraswap-limit-orders-e2e-test.ts
  await createOrder('10000000000000000000', '20000000000000000');
  await createOrder('50000000000000000000', '110000000000000000');
  await createOrder('70000000000000000000', '170000000000000000');
})();
