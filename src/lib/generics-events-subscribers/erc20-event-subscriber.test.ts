import dotenv from 'dotenv';
dotenv.config();

import { ERC20StateMap } from './types';
import { ERC20EventSubscriber } from './erc20-event-subscriber';
import { Network } from '../../constants';
import { Address, Token } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { getBalances } from '../tokens/balancer-fetcher';
import {
  AssetType,
  DEFAULT_ID_ERC20,
  DEFAULT_ID_ERC20_AS_STRING,
} from '../tokens/types';
import { MultiWrapper } from '../multi-wrapper';

jest.setTimeout(50 * 1000);

async function fetchBalance(
  multiWrapper: MultiWrapper,
  token: string,
  wallet: string,
  blockNumber: number,
): Promise<ERC20StateMap> {
  const balances = await getBalances(
    multiWrapper,
    [
      {
        owner: wallet,
        asset: token,
        assetType: AssetType.ERC20,
        ids: [
          {
            id: DEFAULT_ID_ERC20,
            spenders: [],
          },
        ],
      },
    ],
    blockNumber,
  );

  const state = {} as ERC20StateMap;

  state[wallet] = {
    balance: balances[0].amounts[DEFAULT_ID_ERC20_AS_STRING],
  };
  return state;
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;
type WalletMapping = Record<string, EventMappings>;

describe('ERC20 Subscriber Mainnet', function () {
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const token: Token = {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    decimals: 18,
  };

  let erc20sub: ERC20EventSubscriber;

  // tokenAddress -> EventMappings
  const eventsToTest: Record<Address, WalletMapping> = {
    '0x23fcf8d02b1b515ca40ec908463626c1759c2756': {
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
        Withdrawal: [16074564],
      },
    },
    '0x39074b2b4434bf3115890094e1360e36d42ecbbd': {
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
        Transfer: [16074810],
      },
    },
    '0x402df14df2080c5d946a8e2fc1b4bf78cbb1e73a': {
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
        Transfer: [16074809],
      },
    },
  };

  beforeAll(() => {
    erc20sub = new ERC20EventSubscriber(dexHelper, token.address);
  });

  Object.keys(eventsToTest).forEach(async walletAddress => {
    const eventsWithTokens = eventsToTest[walletAddress];
    Object.entries(eventsWithTokens).forEach(
      ([tokenAddress, events]: [string, EventMappings]) => {
        describe(`Events for ${tokenAddress}`, () => {
          Object.entries(events).forEach(
            ([eventName, blockNumbers]: [string, number[]]) => {
              describe(`${eventName}`, () => {
                blockNumbers.forEach((blockNumber: number) => {
                  it(`State after ${blockNumber}`, async function () {
                    await erc20sub.subscribeToWalletBalanceChange(
                      walletAddress,
                      blockNumber - 1,
                    );
                    await testEventSubscriber(
                      erc20sub,
                      [token.address],
                      (_blockNumber: number) =>
                        fetchBalance(
                          dexHelper.multiWrapper,
                          token.address,
                          walletAddress,
                          _blockNumber,
                        ),
                      blockNumber,
                      `${token.address}-${walletAddress}-${blockNumber}`,
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
  });
});
