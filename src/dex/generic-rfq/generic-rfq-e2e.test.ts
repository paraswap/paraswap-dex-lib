import dotenv from 'dotenv';
dotenv.config();

import { Network, ContractMethod, SwapSide, MAX_UINT } from '../../constants';
import { generateConfig } from '../../config';
import { newTestE2E } from '../../../tests/utils-e2e';
import { SmartTokens, GENERIC_ADDR1 } from '../../../tests/constants-e2e';
import { startTestServer } from './example-api.test';
import { ethers } from 'ethers';
const PK_KEY = process.env.TEST_PK_KEY;

if (!PK_KEY) {
  throw new Error('Mising TEST_PK_KEY');
}

const account = new ethers.Wallet(PK_KEY!);
const stopServer = startTestServer(account);

describe('GenericRFQ E2E Mainnet', () => {
  const network = Network.MAINNET;
  const smartTokens = SmartTokens[network];

  const srcToken = smartTokens.WETH;
  const destToken = smartTokens.DAI;

  const config = generateConfig(network);

  describe('GenericRFQ', () => {
    const dexKey = 'DummyParaSwapPool';

    srcToken.addBalance(account.address, MAX_UINT);
    srcToken.addAllowance(account.address, config.augustusRFQAddress, MAX_UINT);

    destToken.addBalance(account.address, MAX_UINT);
    destToken.addAllowance(
      account.address,
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
          _amount: '1000000000000000000',
          swapSide: SwapSide.BUY,
          dexKey: dexKey,
          contractMethod: ContractMethod.simpleSwap,
          network: network,
        });
      });

      it('BUY DAI -> WETH', async () => {
        await newTestE2E({
          config,
          destToken,
          srcToken,
          senderAddress: GENERIC_ADDR1,
          _amount: '1000000000000000000',
          swapSide: SwapSide.BUY,
          dexKey: dexKey,
          contractMethod: ContractMethod.simpleSwap,
          network: network,
        });
      });
    });
  });

  afterAll(() => {
    stopServer();
  });
});
