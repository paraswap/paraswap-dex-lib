import {
  constructAxiosFetcher,
  constructBuildLimitOrder,
  constructEthersContractCaller,
  constructPartialSDK,
  constructSignLimitOrder,
  LimitOrderToSend,
} from '@paraswap/sdk';
import axios from 'axios';
import { ethers } from 'ethers';
import express from 'express';

const markets = {
  markets: [
    {
      id: 'WETH-DAI',
      base: {
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        decimals: 18,
        type: 'erc20',
      },
      quote: {
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
        type: 'erc20',
      },
      status: 'available',
    },
  ],
};

const prices = {
  'WETH-DAI': {
    buyAmounts: [
      '1.166200000000000000',
      '1.166200000000000000',
      '1.166200000000000000',
      '1.166200000000000000',
      '1.166200000000000000',
      '1.169000000000000000',
    ],
    buyPrices: [
      '1333.425240000000000000',
      '1333.024812000000000000',
      '1332.624384000000000000',
      '1332.223956000000000000',
      '1331.823528000000000000',
      '1331.423100000000000000',
    ],
    sellAmounts: [
      '1.166200000000000000',
      '1.166200000000000000',
      '1.166200000000000000',
      '1.166200000000000000',
      '1.166200000000000000',
      '1.169000000000000000',
    ],
    sellPrices: [
      '1336.745410000000000000',
      '1337.146033000000000000',
      '1337.546656000000000000',
      '1337.947279000000000000',
      '1338.347902000000000000',
      '1338.748525000000000000',
    ],
  },
};

type RFQPayload = {
  makerAsset: string;
  takerAsset: string;
  model: 'firm';
  side: 'sell' | 'buy';
  makerAmount?: string;
  takerAmount?: string;
  taker: string;
  txOrigin: string;
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

    const signableOrderData = await paraSwapLimitOrderSDK.buildLimitOrder({
      maker: account.address,
      taker: payload.txOrigin,
      expiry: 0,
      makerAsset: payload.makerAsset,
      takerAsset: payload.takerAsset,
      makerAmount: payload.makerAmount ? payload.makerAmount : '1',
      takerAmount: payload.takerAmount ? payload.takerAmount : '1',
    });

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
