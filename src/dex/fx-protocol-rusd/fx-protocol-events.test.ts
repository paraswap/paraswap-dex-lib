import dotenv from 'dotenv';
dotenv.config();

import { FxProtocolRusdEvent } from './fx-protocol-rusd-event';
import { FxProtocolConfig } from './config';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import FxUSD_ABI from '../../abi/fx-protocol/FxUSD.json';
import FxMarket_ABI from '../../abi/fx-protocol/FxMarket.json';
import EthWeETHOralce_ABI from '../../abi/fx-protocol/weETHOralce.json';

import _ from 'lodash';
import { FxProtocolPoolState } from './types';
import { Interface } from 'ethers/lib/utils';
import { JsonFragment } from '@ethersproject/abi';

/*
  README
  ======

  This test script adds unit tests for fxProtocol event based
  system. This is done by fetching the state on-chain before the
  event block, manually pushing the block logs to the event-subscriber,
  comparing the local state with on-chain state.

  Most of the logic for testing is abstracted by `testEventSubscriber`.
  You need to do two things to make the tests work:

  1. Fetch the block numbers where certain events were released. You
  can modify the `./scripts/fetch-event-blocknumber.ts` to get the
  block numbers for different events. Make sure to get sufficient
  number of blockNumbers to cover all possible cases for the event
  mutations.

  2. Complete the implementation for fetchPoolState function. The
  function should fetch the on-chain state of the event subscriber
  using just the blocknumber.

  The template tests only include the test for a single event
  subscriber. There can be cases where multiple event subscribers
  exist for a single DEX. In such cases additional tests should be
  added.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-events.test.ts`

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);
const dexKey = 'FxProtocolRusd';
const network = Network.MAINNET;

async function fetchPoolState(
  fxProtocolPool: FxProtocolRusdEvent,
  blockNumber: number,
): Promise<FxProtocolPoolState> {
  return fxProtocolPool.generateState(blockNumber);
}

describe('FxProtocolRusd Event', function () {
  const blockNumbers: { [eventName: string]: number[] } = {
    UpdateRedeemFeeRatioFToken: [19460858, 19465918, 19460857],
    AnswerUpdated: [20482537, 20481328, 20480824, 20480670, 20480669],
  };

  describe('FxProtocolRusdPool', function () {
    Object.keys(blockNumbers).forEach((event: string) => {
      blockNumbers[event].forEach((blockNumber: number) => {
        it(`Should return the correct state after the ${blockNumber}:${event}`, async function () {
          const dexHelper = new DummyDexHelper(network);
          const logger = dexHelper.getLogger(dexKey);
          const config = FxProtocolConfig[dexKey][network];

          const fxProtocolPool = new FxProtocolRusdEvent(
            dexKey,
            dexHelper,
            config.rUSDWeETHMarketAddress,
            new Interface(FxMarket_ABI as JsonFragment[]),
            config.weETHOracleAddress,
            new Interface(EthWeETHOralce_ABI as JsonFragment[]),
            logger,
          );

          await fxProtocolPool.initialize(blockNumber);

          await testEventSubscriber(
            fxProtocolPool,
            fxProtocolPool.addressesSubscribed,
            (_blockNumber: number) =>
              fetchPoolState(fxProtocolPool, _blockNumber),
            blockNumber,
            `${dexKey}_${fxProtocolPool}`,
            dexHelper.provider,
          );
        });
      });
    });
  });
});
