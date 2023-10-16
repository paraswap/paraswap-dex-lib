/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { VerifiedEventPool } from './verified-pool';
import { Network, SwapSide } from '../../constants';
import { Address, Token } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState, PoolStateMap, SubgraphPoolBase } from './types';
import { VerifiedConfig } from './config';
import { assert } from 'console';

jest.setTimeout(50 * 1000);
async function fetchPoolState(
  verifiedPool: VerifiedEventPool,
  blockNumber: number,
): Promise<PoolStateMap> {
  return await verifiedPool.generateState(blockNumber);
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('Verified EventPool', function () {
  const parentName = 'Verified'; //DexKey or DexName
  const network = Network.POLYGON;
  const networkConfig = VerifiedConfig[parentName][network];
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(parentName);

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    '0x1871c8321b099c3c0e8a69340a8bf93f3d4b1c9a': {
      Swap: [48391093],
    },
    '0x1b96d5660be3e948ddf331aa05e46c59c6a832f4': {
      Swap: [48391093],
    },
  };
  let verifiedPool: VerifiedEventPool;
  beforeEach(async () => {
    verifiedPool = new VerifiedEventPool(
      parentName,
      network,
      dexHelper,
      networkConfig.vaultAddress,
      networkConfig.subGraphUrl,
      logger,
    );
  });

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings]) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  await testEventSubscriber(
                    verifiedPool,
                    verifiedPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(verifiedPool, _blockNumber),
                    blockNumber,
                    `${parentName}_${poolAddress}`,
                    dexHelper.provider,
                  );
                });
              });
            });
          },
        );
      });
    },
  );

  describe('Custom Test', () => {
    it('PrimaryIssue Pool getPricesPool test: ', async () => {
      const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const poolsMap = await fetchPoolState(verifiedPool, blockNumber);
      expect(verifiedPool.allPools.length).toBeGreaterThan(0);
      const creator: string = ''; //not needed in primary pool price calculation
      //This tests Primary pool with address: 0x1b96d5660be3e948ddf331aa05e46c59c6a832f4
      const poolState = poolsMap['0x1b96d5660be3e948ddf331aa05e46c59c6a832f4'];
      const subgraphPool = verifiedPool.allPools.find(
        pool =>
          pool.address.toLowerCase() ===
          '0x1b96d5660be3e948ddf331aa05e46c59c6a832f4'.toLowerCase(),
      );
      //test for maintokens: (must not include bpt token/poolAddress)
      subgraphPool?.mainTokens.forEach(token => {
        expect(
          assert(
            token.address.toLowerCase() !== subgraphPool.address.toLowerCase(),
            'Maintokens Test Failed: Maintokens contain bpt/pool token',
          ),
        );
      });
      let tokens: Token[] = [];
      subgraphPool?.mainTokens.forEach(token => {
        const _token = subgraphPool.tokens.find(
          t => t.address === token.address,
        );
        tokens.push({
          address: _token?.address!,
          decimals: _token?.decimals!,
        });
      });
      const cashAmounts = [1000000n, 2150160n];
      const securityAmounts = [1000000000000000000n, 1749284608758693473n];
      const fixedCashAmount = Number(cashAmounts[1]) / 10 ** 6; //cash/currency decimals
      const fixedSecurityAmount = Number(securityAmounts[1]) / 10 ** 18; //security decimals
      const price1 = verifiedPool.getPricesPool(
        tokens[0],
        tokens[1],
        subgraphPool!,
        poolState,
        [0n, securityAmounts[1]],
        securityAmounts[0],
        SwapSide.SELL,
        creator,
      );
      const price2 = verifiedPool.getPricesPool(
        tokens[1],
        tokens[0],
        subgraphPool!,
        poolState,
        [0n, cashAmounts[1]],
        cashAmounts[0],
        SwapSide.SELL,
        creator,
      );
      const price3 = verifiedPool.getPricesPool(
        tokens[0],
        tokens[1],
        subgraphPool!,
        poolState,
        [0n, cashAmounts[1]], //amount will change to token out amount for buy
        cashAmounts[0],
        SwapSide.BUY,
        creator,
      );
      const price4 = verifiedPool.getPricesPool(
        tokens[1],
        tokens[0],
        subgraphPool!,
        poolState,
        [0n, securityAmounts[1]], //amount will change to token out amount for buy
        securityAmounts[0],
        SwapSide.BUY,
        creator,
      );
      // //log the results to best explain the prices
      console.log(
        `Primary Pool(address: ${subgraphPool?.address}) ${price1?.prices[1]}(${
          Number(price1?.prices[1]) / 10 ** 6 //cash/currency decimals
        }) Currency token will be paid out when you sell ${
          securityAmounts[1]
        }(${fixedSecurityAmount}) Security token`,
      );
      console.log(
        `In ${subgraphPool?.poolType} Pool(address: ${subgraphPool?.address}) ${
          price2?.prices[1]
        }(${
          Number(price2?.prices[1]) / 10 ** 18 //security decimals
        }) Security token will be paid out when you sell ${
          cashAmounts[1]
        }(${fixedCashAmount}) currency token`,
      );
      console.log(
        `In ${subgraphPool?.poolType} Pool(address: ${subgraphPool?.address}) ${
          price3?.prices[1]
        }(${
          Number(price3?.prices[1]) / 10 ** 18 //security decimals
        }) Security token will be paid in when you buy ${
          cashAmounts[1]
        } (${fixedCashAmount}) Currency token`,
      );
      console.log(
        `In ${subgraphPool?.poolType} Pool(address: ${subgraphPool?.address}) ${
          price4?.prices[1]
        }(${
          Number(price4?.prices[1]) / 10 ** 6 //cash/currency decimals
        }) Currency token will be paid in when you buy ${
          securityAmounts[1]
        }(${fixedSecurityAmount}) Security token`,
      );
    });
  });
});
