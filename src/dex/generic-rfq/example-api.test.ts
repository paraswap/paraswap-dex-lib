import {
  constructAxiosFetcher,
  constructBuildLimitOrder,
  constructEthersContractCaller,
  constructPartialSDK,
  constructSignLimitOrder,
  LimitOrderToSend,
} from '@paraswap/sdk';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import express from 'express';
import { RFQPayload, PairPriceResponse } from './types';
import { reversePrice } from './rate-fetcher';
import { SwapSide } from '@paraswap/core';

const markets = {
  markets: [
    {
      name: 'WETH-DAI',
      id: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2_0x6b175474e89094c44da98b954eedeac495271d0f',
      base: {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        decimals: 18,
        type: 'erc20',
      },
      quote: {
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        decimals: 18,
        type: 'erc20',
      },
      status: 'available',
    },
  ],
};

const prices: Record<string, PairPriceResponse> = {
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2_0x6b175474e89094c44da98b954eedeac495271d0f':
    {
      bids: [
        {
          price: '1333.425240000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1333.024812000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1332.624384000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1332.223956000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1331.823528000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1331.423100000000000000',
          amount: '1.169000000000000000',
        },
      ],
      asks: [
        {
          price: '1336.745410000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1337.146033000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1337.546656000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1337.947279000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1338.347902000000000000',
          amount: '1.166200000000000000',
        },
        {
          price: '1338.748525000000000000',
          amount: '1.169000000000000000',
        },
      ],
    },
};

export const startTestServer = (account: ethers.Wallet) => {
  const app = express();

  /**
   * Use JSON Body parser...
   */
  app.use(express.json({ strict: false }));

  app.get('/markets', (req, res) => {
    return res.status(200).json(markets);
  });

  app.get('/prices', (req, res) => {
    return res.status(200).json(prices);
  });

  const fetcher = constructAxiosFetcher(axios);

  const contractCaller = constructEthersContractCaller(
    {
      ethersProviderOrSigner: account,
      EthersContract: ethers.Contract,
    },
    account.address,
  );

  const paraSwapLimitOrderSDK = constructPartialSDK(
    {
      chainId: 1,
      fetcher,
      contractCaller,
    },
    constructBuildLimitOrder,
    constructSignLimitOrder,
  );

  app.post('/firm', async (req, res) => {
    const payload: RFQPayload = req.body;

    console.log(payload);

    let reversed = false;

    let value = new BigNumber('0');

    if (payload.makerAmount) {
      // buy
      let _prices: PairPriceResponse =
        prices[`${payload.makerAsset}_${payload.takerAsset}`.toLowerCase()];
      if (!_prices) {
        _prices =
          prices[`${payload.takerAsset}_${payload.makerAsset}`.toLowerCase()];
        reversed = true;
      }
      if (!reversed) {
        value = new BigNumber(payload.makerAmount).times(
          new BigNumber(_prices.asks[0].price),
        );
      } else {
        const reversedPrices = _prices.bids.map(price =>
          reversePrice({
            amount: new BigNumber(price.amount),
            price: new BigNumber(price.price),
          }),
        );
        value = new BigNumber(payload.makerAmount).times(
          new BigNumber(reversedPrices[0].price),
        );
      }
    } else if (payload.takerAmount) {
      // sell
      let _prices: PairPriceResponse =
        prices[`${payload.takerAsset}_${payload.makerAsset}`.toLowerCase()];

      if (!_prices) {
        _prices =
          prices[`${payload.makerAsset}_${payload.takerAsset}`.toLowerCase()];
        reversed = true;
      }
      if (!reversed) {
        value = new BigNumber(payload.takerAmount).times(
          new BigNumber(_prices.bids[0].price),
        );
      } else {
        const reversedPrices = _prices.asks.map(price =>
          reversePrice({
            amount: new BigNumber(price.amount),
            price: new BigNumber(price.price),
          }),
        );
        value = new BigNumber(payload.takerAmount).times(
          new BigNumber(reversedPrices[0].price),
        );
      }
    }

    const order = {
      maker: account.address,
      taker: payload.txOrigin,
      expiry: 0,
      makerAsset: payload.makerAsset,
      takerAsset: payload.takerAsset,
      makerAmount: payload.makerAmount ? payload.makerAmount : value.toFixed(0),
      takerAmount: payload.takerAmount ? payload.takerAmount : value.toFixed(0),
    };

    console.log(order, 'reversed:', reversed);
    const signableOrderData = await paraSwapLimitOrderSDK.buildLimitOrder(
      order,
    );

    const signature = await paraSwapLimitOrderSDK.signLimitOrder(
      signableOrderData,
    );
    const orderToPostToApi: LimitOrderToSend = {
      ...signableOrderData.data,
      signature,
    };

    return res.status(200).json({
      status: 'accepted',
      order: orderToPostToApi,
    });
  });

  const server = app.listen(parseInt(process.env.TEST_PORT!, 10));
  return () => {
    server.close();
  };
};
