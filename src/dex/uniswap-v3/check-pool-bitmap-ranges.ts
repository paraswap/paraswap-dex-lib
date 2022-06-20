/*
 * It is just standalone helper script to estimate how wide bitMap range can be.
 * We need it in order to cover all possible state variations
 */
import * as dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import Web3 from 'web3';
import { Interface } from '@ethersproject/abi';
import _ from 'lodash';
import MulticallABI from '../../abi/multi-v2.json';
import UniswapV3PoolABI from '../../abi/uniswap-v3/UniswapV3Pool.abi.json';
import { UNISWAPV3_SUBGRAPH_URL } from './constants';
import { MULTI_V2, Network, ProviderURL } from '../../constants';
import { BI_MAX_INT16, BI_MIN_INT16 } from '../../bigint-constants';

type SubgraphResult = { id: string; totalValueLockedUSD: string };

const network = Network.MAINNET;

const web3Provider = new Web3(ProviderURL[network]);
const multicallContract = new web3Provider.eth.Contract(
  MulticallABI as any,
  MULTI_V2[network],
);

const poolIface = new Interface(UniswapV3PoolABI);

async function getBitmap(
  pool: string,
  blockNumber: number,
  indexes: number[],
): Promise<Record<number, bigint>> {
  const callData = indexes.map(ind => ({
    target: pool,
    callData: poolIface.encodeFunctionData('tickBitmap', [ind]),
  }));

  try {
    const result = await multicallContract.methods
      .aggregate(callData)
      .call({}, blockNumber);

    const decoded = result.returnData.map((d: string): bigint =>
      BigInt(poolIface.decodeFunctionResult('tickBitmap', d)[0]),
    ) as bigint[];

    return decoded.reduce<Record<number, bigint>>((acc, curr, i) => {
      if (curr !== 0n) {
        acc[indexes[i]] = curr;
      }
      return acc;
    }, {});
  } catch (e) {
    console.log(
      `Can not fetch bitMaps for ${pool}. Indexes from ${indexes[0]} to ${
        indexes.slice(-1)[0]
      }. Pool state is not full`,
      e,
    );
    return [];
  }
}

async function getBitmaps(
  pool: string,
  blockNumber: number,
  start: number,
  end: number,
  chunks: number,
): Promise<Record<number, bigint>> {
  const total = Math.abs(start) + end + 1;
  const indexes = _.range(start, end + 1);

  const chunked = _.chunk(indexes, Math.ceil(total / chunks));

  const bitMapArrays = await Promise.all(
    chunked.map(async chunk => getBitmap(pool, blockNumber, chunk)),
  );

  // if (bitMapArrays.some(bitMapArray => Object.keys(bitMapArray).length === 0)) {
  //   return {};
  // }

  const bitMapsReduced = bitMapArrays.reduce<Record<number, bigint>>(
    (acc, curr) => ({ ...acc, ...curr }),
    {},
  );

  return bitMapsReduced;
}

async function getPools(): Promise<SubgraphResult[]> {
  const query = `
    {
      pools(first: 1000, orderBy: totalValueLockedUSD, orderDirection: desc) {
        id
        totalValueLockedUSD
        }
    }
  `;
  try {
    const res = await axios.post<{ data: { pools: SubgraphResult[] } }>(
      UNISWAPV3_SUBGRAPH_URL,
      { query },
    );
    return res.data.data.pools;
  } catch (e) {
    console.log(e);
    return [];
  }
}

(async function main() {
  const blockNumber = await web3Provider.eth.getBlockNumber();
  const pools = await getPools();
  const lowerTickBitmap = Number(BI_MIN_INT16);
  const upperTickBitmap = Number(BI_MAX_INT16);
  const chunks = 20;
  const poolsNumToProcess = 1;
  const poolStartToProcess = 0;

  let globalMin = Number(BI_MAX_INT16);
  let globalMax = Number(BI_MIN_INT16);
  const indexesCounter: Record<number, number> = {};

  const chunkedPools = _.chunk(pools, poolsNumToProcess);

  for (const [index, chunkedPool] of chunkedPools
    .slice(poolStartToProcess)
    .entries()) {
    console.log(`\nStart processing #${poolStartToProcess + index} pools...`);
    const start = Date.now();
    await Promise.all(
      chunkedPool.map(async pool => {
        const bitMaps = await getBitmaps(
          pool.id,
          blockNumber,
          lowerTickBitmap,
          upperTickBitmap,
          chunks,
        );

        let newGlobalMinPosition = { index: globalMin, value: 0n };
        let newGlobalMaxPosition = { index: globalMax, value: 0n };
        Object.keys(bitMaps).map(v => {
          const parsed = Number(v);
          indexesCounter[parsed] =
            indexesCounter[parsed] === undefined
              ? 1
              : indexesCounter[parsed] + 1;

          if (parsed < newGlobalMinPosition.index) {
            newGlobalMinPosition.index = parsed;
            newGlobalMinPosition.value = bitMaps[parsed];
          }
          if (parsed > newGlobalMaxPosition.index) {
            newGlobalMaxPosition.index = parsed;
            newGlobalMaxPosition.value = bitMaps[parsed];
          }

          return parsed;
        });

        if (newGlobalMinPosition.index !== globalMin) {
          console.log(
            `Found new globalMin=${newGlobalMinPosition.index} in pool ${pool.id} and value=${newGlobalMinPosition.value}`,
          );
          globalMin = newGlobalMinPosition.index;
        }
        if (newGlobalMaxPosition.index !== globalMax) {
          console.log(
            `Found new globalMax=${newGlobalMaxPosition.index} in pool ${pool.id} and value=${newGlobalMaxPosition.value}`,
          );
          globalMax = newGlobalMaxPosition.index;
        }
      }),
    );

    console.log(
      `Done processing #${index} pools Took ${Math.floor(
        (Date.now() - start) / 1000,
      )} sec. Current indexesCounter state is:`,
    );
    console.log(JSON.stringify(indexesCounter));
    console.log(indexesCounter);
  }
})();
