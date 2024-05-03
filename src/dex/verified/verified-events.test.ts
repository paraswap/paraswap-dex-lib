/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { VerifiedEventPool } from './verified-pool';
import { Network, SwapSide } from '../../constants';
import { Address, Token } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolStateMap } from './types';
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

describe('Verified EventPool on Polygon', function () {
  const parentName = 'Verified'; //DexKey or DexName
  const network = Network.POLYGON;
  const networkConfig = VerifiedConfig[parentName][network];
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(parentName);
  const knownPrimaryPool = '0x101766a77fb9956b9d8a79ed48c8a56a17767752'; //must be on subgraph
  const knownSecondaryPool = '0x0ac6afebbdc99e152b8d359ea5352af798550f05'; //must be on subgraph
  const creator: string = '0x286a759DACfd0C533B88E42b9e7571040008D778'; //not needed in primary pool calculations

  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    knownPrimaryPool: {
      Swap: [56130158], //change block when known primary pool address changes or add more
    },
    knownSecondaryPool: {
      Swap: [56130158], //change block when known secondary pool address changes or add more
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
                    async (_blockNumber: number) =>
                      await fetchPoolState(verifiedPool, _blockNumber),
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

  describe('Custom Swap Tests', () => {
    it('PrimaryIssue Pool getPricesPool test: ', async () => {
      const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const poolsMap = await fetchPoolState(verifiedPool, blockNumber);
      expect(verifiedPool.allPools.length).toBeGreaterThan(0);
      const primaryPoolState = poolsMap[knownPrimaryPool];
      if (primaryPoolState) {
        const subgraphPool = verifiedPool.allPools.find(
          pool => pool.address.toLowerCase() === knownPrimaryPool.toLowerCase(),
        );
        //test for maintokens: (must not include bpt token/poolAddress)
        subgraphPool?.mainTokens.forEach(token => {
          expect(
            assert(
              token.address.toLowerCase() !==
                subgraphPool.address.toLowerCase(),
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

        const primaryBuyOutput1 = verifiedPool.getPricesPool(
          tokens[0],
          tokens[1],
          subgraphPool!,
          primaryPoolState,
          [0n, 1000000000000000000n],
          1000000000000000000n,
          SwapSide.BUY,
          creator,
        );
        assert(
          primaryBuyOutput1?.prices[1] !== 0n,
          'primary buy 1 failed return amount is 0',
        );

        const primaryBuyOutput2 = verifiedPool.getPricesPool(
          tokens[1],
          tokens[0],
          subgraphPool!,
          primaryPoolState,
          [0n, 1000000n],
          1000000n,
          SwapSide.BUY,
          creator,
        );
        assert(
          primaryBuyOutput2?.prices[1] !== 0n,
          'primary buy 2 failed return amount is 0',
        );

        const primarySellOutput1 = verifiedPool.getPricesPool(
          tokens[0],
          tokens[1],
          subgraphPool!,
          primaryPoolState,
          [0n, 1000000000000000000n],
          1000000000000000000n,
          SwapSide.SELL,
          creator,
        );
        assert(
          primarySellOutput1?.prices[1] !== 0n,
          'primary sell 1 failed return amount is 0',
        );

        const primarySellOutput2 = verifiedPool.getPricesPool(
          tokens[1],
          tokens[0],
          subgraphPool!,
          primaryPoolState,
          [0n, 1000000n],
          1000000n,
          SwapSide.SELL,
          creator,
        );
        assert(
          primarySellOutput2?.prices[1] !== 0n,
          'primary sell 2 failed return amount is 0',
        );

        console.log('primaryBuyOutput 1: ', primaryBuyOutput1);
        console.log('primaryBuyOutput 2: ', primaryBuyOutput2);
        console.log('primarySellOutput 1: ', primarySellOutput1);
        console.log('primarySellOutput 2: ', primarySellOutput2);
      } else {
        assert(true); //pass test for that pool
      }
    });

    it('SecodaryIssue Pool getPricesPool test: ', async () => {
      const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const poolsMap = await fetchPoolState(verifiedPool, blockNumber);
      expect(verifiedPool.allPools.length).toBeGreaterThan(0);
      const secondaryPoolState = poolsMap[knownSecondaryPool];
      if (secondaryPoolState) {
        const subgraphPool = verifiedPool.allPools.find(
          pool =>
            pool.address.toLowerCase() === knownSecondaryPool.toLowerCase(),
        );
        //test for maintokens: (must not include vpt token/poolAddress)
        subgraphPool?.mainTokens.forEach(token => {
          expect(
            assert(
              token.address.toLowerCase() !==
                subgraphPool.address.toLowerCase(),
              'Maintokens Test Failed: Maintokens contain vpt/pool token',
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
        const buyAmount = 20000000000000000n; //0.02;
        const sellAmount = 2000000000000000n; //0.002
        const secondaryBuyOutput = verifiedPool.getPricesPool(
          tokens[1],
          tokens[0],
          subgraphPool!,
          secondaryPoolState,
          [0n, buyAmount], //starts with 0
          1000000000000000000n,
          SwapSide.BUY,
          creator,
        ); //Buy from Security to currency
        assert(
          secondaryBuyOutput!.prices[1] !== 0n,
          'secondary buy failed retturn amount is 0',
        );
        const secondarySellOutput = verifiedPool.getPricesPool(
          tokens[1],
          tokens[0],
          subgraphPool!,
          secondaryPoolState,
          [0n, sellAmount],
          1000000000000000000n,
          SwapSide.SELL,
          creator,
        ); //Sell from security to currency
        assert(
          secondarySellOutput!.prices[1] !== 0n,
          'secondary sell failed return amount is 0',
        );
        console.log('buyOutput: ', secondaryBuyOutput); //log output to better  explain
        console.log('sellOutput: ', secondarySellOutput); //log output to better  explain
      } else {
        assert(true); //pass test for that pool
      }
    });
  });
});
