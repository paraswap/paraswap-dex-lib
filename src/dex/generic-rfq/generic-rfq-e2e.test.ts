import dotenv from 'dotenv';
dotenv.config();

import { Network, ContractMethod, SwapSide, MAX_UINT } from '../../constants';
import { generateConfig } from '../../config';
import { newTestE2E } from '../../../tests/utils-e2e';
import {
  SmartTokens,
  GENERIC_ADDR1,
  testAccount,
} from '../../../tests/constants-e2e';
import { startTestServer } from './example-api.testhelper';

jest.setTimeout(1000 * 60 * 3);

const stopServer = startTestServer(testAccount);

describe('GenericRFQ E2E Mainnet', () => {
  const network = Network.MAINNET;
  const smartTokens = SmartTokens[network];

  const srcToken = smartTokens.WETH;
  const destToken = smartTokens.DAI;

  const config = generateConfig(network);

  describe('GenericRFQ', () => {
    const dexKey = 'DummyParaSwapPool';

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

    describe('Simpleswap', () => {
      it('SELL WETH -> DAI', async () => {
        await newTestE2E({
          config,
          srcToken,
          destToken,
          senderAddress: GENERIC_ADDR1,
          thirdPartyAddress: testAccount.address,
          _amount: '1000000000000000000',
          swapSide: SwapSide.SELL,
          dexKey: dexKey,
          contractMethod: ContractMethod.simpleSwap,
          network: network,
        });
      });

      it('SELL DAI -> WETH', async () => {
        await newTestE2E({
          config,
          destToken,
          srcToken,
          senderAddress: GENERIC_ADDR1,
          thirdPartyAddress: testAccount.address,
          _amount: '1000000000000000000',
          swapSide: SwapSide.SELL,
          dexKey: dexKey,
          contractMethod: ContractMethod.simpleSwap,
          network: network,
        });
      });

      it('BUY WETH -> DAI', async () => {
        await newTestE2E({
          config,
          srcToken,
          destToken,
          senderAddress: GENERIC_ADDR1,
          thirdPartyAddress: testAccount.address,
          _amount: '1000000000000000000',
          swapSide: SwapSide.BUY,
          dexKey: dexKey,
          contractMethod: ContractMethod.simpleBuy,
          network: network,
        });
      });

      it('BUY DAI -> WETH', async () => {
        await newTestE2E({
          config,
          destToken,
          srcToken,
          senderAddress: GENERIC_ADDR1,
          thirdPartyAddress: testAccount.address,
          _amount: '1000000000000000000',
          swapSide: SwapSide.BUY,
          dexKey: dexKey,
          contractMethod: ContractMethod.simpleBuy,
          network: network,
        });
      });
    });
  });

  afterAll(async () => {
    await stopServer();
  });
});
