import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { Network, ContractMethod, SwapSide, MAX_UINT } from '../../constants';
import { generateConfig } from '../../config';
import { newTestE2E, getEnv } from '../../../tests/utils-e2e';
import { SmartTokens, GENERIC_ADDR1 } from '../../../tests/constants-e2e';
import { RFQConfig } from './types';
import { testConfig } from './e2e-test-config';

const PK_KEY = process.env.TEST_PK_KEY;

if (!PK_KEY) {
  throw new Error('Missing TEST_PK_KEY');
}

const testAccount = new ethers.Wallet(PK_KEY!);

jest.setTimeout(1000 * 60 * 3);

const buildConfigForGenericRFQ = (): RFQConfig => {
  const url = getEnv('GENERIC_RFQ_URL');

  const secret = {
    secretKey: Buffer.from(getEnv('GENERIC_RFQ_SECRET_KEY'), 'base64').toString(
      'binary',
    ),
    accessKey: getEnv('GENERIC_RFQ_ACCESS_KEY'),
    domain: 'paraswap',
  };

  const pathToRemove = getEnv('GENERIC_RFQ_PATH_TO_OVERRIDE', true);

  return {
    maker: getEnv('GENERIC_RFQ_MAKER_ADDRESS'),
    tokensConfig: {
      reqParams: {
        url: `${url}/tokens`,
        method: 'GET',
      },
      secret,
      intervalMs: 1000 * 60 * 60 * 10, // every 10 minutes
      dataTTLS: 1000 * 60 * 60 * 11, // ttl 11 minutes
    },
    pairsConfig: {
      reqParams: {
        url: `${url}/pairs`,
        method: 'GET',
      },
      secret,
      intervalMs: 1000 * 60 * 60 * 10, // every 10 minutes
      dataTTLS: 1000 * 60 * 60 * 11, // ttl 11 minutes
    },
    rateConfig: {
      reqParams: {
        url: `${url}/prices`,
        method: 'GET',
      },
      secret,
      intervalMs: 1000 * 60 * 60 * 1, // every 1 minute
      dataTTLS: 1000 * 60 * 60 * 1, // ttl 1 minute
    },
    firmRateConfig: {
      url: `${url}/firm`,
      method: 'POST',
      secret,
    },
    blacklistConfig: {
      reqParams: {
        url: `${url}/blacklist`,
        method: 'GET',
      },
      secret,
      intervalMs: 1000 * 60 * 60 * 10,
      dataTTLS: 1000 * 60 * 60 * 11,
    },
    pathToRemove,
  };
};

const SKIP_TENDERLY = !!getEnv('GENERIC_RFQ_SKIP_TENDERLY', true);
const dexKey = 'YOUR_NAME';

describe(`GenericRFQ ${dexKey} E2E`, () => {
  for (const [_network, testCases] of Object.entries(testConfig)) {
    const network = parseInt(_network, 10);
    const smartTokens = SmartTokens[network];
    const config = generateConfig(network);

    config.rfqConfigs[dexKey] = buildConfigForGenericRFQ();
    describe(`${Network[network]}`, () => {
      for (const testCase of testCases) {
        if (!smartTokens.hasOwnProperty(testCase.srcToken)) {
          throw new Error(
            `Please add "addBalance" and "addAllowance" functions for ${testCase.srcToken} on ${Network[network]} (in constants-e2e.ts).`,
          );
        }
        if (!smartTokens.hasOwnProperty(testCase.destToken)) {
          throw new Error(
            `Please add "addBalance" and "addAllowance" functions for ${testCase.destToken} on ${Network[network]} (in constants-e2e.ts).`,
          );
        }
        const srcToken = smartTokens[testCase.srcToken];
        const destToken = smartTokens[testCase.destToken];

        if (!SKIP_TENDERLY) {
          srcToken.addBalance(testAccount.address, MAX_UINT);
          srcToken.addAllowance(
            testAccount.address,
            config.augustusRFQAddress,
            MAX_UINT,
          );

          destToken.addBalance(testAccount.address, MAX_UINT);
          destToken.addAllowance(
            testAccount.address,
            config.augustusRFQAddress,
            MAX_UINT,
          );
        }
        const contractMethod =
          testCase.swapSide === SwapSide.BUY
            ? ContractMethod.simpleBuy
            : ContractMethod.simpleSwap;
        describe(`${contractMethod}`, () => {
          it(`${testCase.swapSide} ${testCase.srcToken} -> ${testCase.destToken}`, async () => {
            await newTestE2E({
              config,
              srcToken,
              destToken,
              senderAddress: GENERIC_ADDR1,
              thirdPartyAddress: testAccount.address,
              _amount: testCase.amount,
              swapSide: testCase.swapSide as SwapSide,
              dexKey: dexKey,
              contractMethod,
              network,
              sleepMs: 5000,
              skipTenderly: SKIP_TENDERLY,
            });
          });
        });
      }
    });
  }
});
