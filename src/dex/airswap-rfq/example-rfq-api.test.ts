import {
  constructAxiosFetcher,
  constructBuildLimitOrder,
  constructEthersContractCaller,
  constructPartialSDK,
  constructSignLimitOrder,
  LimitOrderToSend,
} from '@paraswap/sdk';
import axios from 'axios';
// import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import express from 'express';
import {
  RFQPayload,
  PairPriceResponse,
  TokensResponse,
  PairsResponse,
  RatesResponse,
} from './types';
import { reversePrice } from './rate-fetcher';

import { createServer } from 'http';
import LastLook from './basic_api/protocols/last-look';
import RFQ from '././basic_api/protocols/request-for-quote';
import { RFQLevels, LLLevels } from './basic_api/levels';

export const startTestServer = (wallet: ethers.Wallet) => {
  const port = parseInt(String(process.env.AIRSWAP_PORT), 10) || 3000;
  const chainId = 5; //Number(process.env.CHAIN_ID)
  // const provider = new ethers.providers.JsonRpcProvider(getNodeURL(chainId, String(process.env.INFURA_API_KEY)))
  // await provider.getNetwork()

  // const wallet = new ethers.Wallet(String(process.env.PRIVATE_KEY), provider)
  const app = express();
  const server = createServer(app);
  const config = {
    app,
    server,
    levels: {
      RFQLevels: (RFQLevels as any)[chainId],
      LLLevels: (LLLevels as any)[chainId],
    },
    wallet,
    chainId,
    gasPrice: `${process.env.GAS_PRICE || 20}000000000`,
    confirmations: String(process.env.CONFIRMATIONS || '2'),
  };

  console.log(`Loaded account`, wallet.address);
  console.log(`Serving for chainID ${chainId}`); //${chainNames[chainId]}

  LastLook(config);
  console.log(`Last-look protocol started`);

  RFQ(config);
  console.log(`Request-for-quote started`);

  console.log(`Listening on port ${port}`);
  server.listen(port);
  return () => {
    server.close();
  };
};
