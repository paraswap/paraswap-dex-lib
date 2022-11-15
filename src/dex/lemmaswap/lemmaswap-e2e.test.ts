import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';
import { Token, Address } from '../../../src/types';

describe('Lemmaswap E2E', () => {
  const dexKey = 'Lemmaswap';

  describe('Optimism', () => {
    const network = Network.OPTIMISM;

    const LemmaSupportedTokens: {
      [network: number]: { [symbol: string]: Token };
    } = {
      [Network.OPTIMISM]: {
        WETH: {
          address: '0x4200000000000000000000000000000000000006',
          decimals: 18,
        },
        ETH: {
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18,
        },
        USDC: {
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
        },
        WBTC: {
          address: '0x68f180fcce6836688e9084f035309e29bf0a2095',
          decimals: 8,
        },
        LINK: {
          address: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6',
          decimals: 18,
        },
        AAVE: {
          address: '0x76FB31fb4af56892A25e32cFC43De717950c9278',
          decimals: 18,
        },
        CRV: {
          address: '0x0994206dfe8de6ec6920ff4d779b0d950605fb53',
          decimals: 18,
        },
        PERP: {
          address: '0x9e1028F5F1D5eDE59748FFceE5532509976840E0',
          decimals: 18,
        },
        USDL: {
          address: '0x96F2539d3684dbde8B3242A51A73B66360a5B541',
          decimals: 18,
        },
      },
    };

    const tokenToWhales: {
      [network: number]: { [symbol: string]: Address };
    } = {
      [Network.OPTIMISM]: {
        // ETH USDC WBTC WETH LINK AAVE CRV PERP ==> whaleaddresses
        ETH: '0x9ef21bE1C270AA1c3c3d750F458442397fBFFCB6',
        USDC: '0xEBb8EA128BbdFf9a1780A4902A9380022371d466',
        WBTC: '0x078f358208685046a11c85e8ad32895ded33a249',
        WETH: '0x85149247691df622eaF1a8Bd0CaFd40BC45154a9',
        LINK: '0x191c10Aa4AF7C30e871E70C95dB0E4eb77237530',
        AAVE: '0xf329e36c7bf6e5e86ce2150875a84ce77f477375',
        CRV: '0x9644a6920bd0a1923c2c6c1dddf691b7a42e8a65',
        PERP: '0xd360b73b19fb20ac874633553fb1007e9fcb2b78',
        USDL: '0x0f3BF5c241B6625C0fA781ED137fDe6786b2e66f',
      },
    };

    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const ethAmount = '1000000000000000';
    const wethAmount = '1000000000000000';
    const usdcAmount = '10000000';
    const wbtcAmount = '59000';
    const linkAmount = '1000000000000000';
    const aaveAmount = '1000000000000000';
    const crvAmount = '1000000000000000';
    const perpAmount = '1000000000000000';
    const usdlAmount = '1000000000000000';

    const nativeToken = LemmaSupportedTokens[Network.OPTIMISM]['ETH'];
    const usdcToken = LemmaSupportedTokens[Network.OPTIMISM]['USDC'];
    const wethToken = LemmaSupportedTokens[Network.OPTIMISM]['WETH'];
    const wbtcToken = LemmaSupportedTokens[Network.OPTIMISM]['WBTC'];
    const linkToken = LemmaSupportedTokens[Network.OPTIMISM]['LINK'];
    const aaveToken = LemmaSupportedTokens[Network.OPTIMISM]['AAVE'];
    const crvToken = LemmaSupportedTokens[Network.OPTIMISM]['CRV'];
    const perpToken = LemmaSupportedTokens[Network.OPTIMISM]['PERP'];
    const usdlToken = LemmaSupportedTokens[Network.OPTIMISM]['USDL'];

    const ethHolder = tokenToWhales[Network.OPTIMISM]['ETH'];
    const usdcHolder = tokenToWhales[Network.OPTIMISM]['USDC'];
    const wethHolder = tokenToWhales[Network.OPTIMISM]['WETH'];
    const wbtcHolder = tokenToWhales[Network.OPTIMISM]['WBTC'];
    const linkHolder = tokenToWhales[Network.OPTIMISM]['LINK'];
    const aaveHolder = tokenToWhales[Network.OPTIMISM]['AAVE'];
    const crvHolder = tokenToWhales[Network.OPTIMISM]['CRV'];
    const perpHolder = tokenToWhales[Network.OPTIMISM]['PERP'];
    const usdlHolder = tokenToWhales[Network.OPTIMISM]['USDL'];

    describe('SimpleSwap SELL', () => {
      const contractMethod = ContractMethod.simpleSwap;
      const side = SwapSide.SELL;

      it('ETH -> USDC', async () => {
        await testE2E(
          nativeToken,
          usdcToken,
          ethHolder,
          ethAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('USDC -> ETH', async () => {
        await testE2E(
          usdcToken,
          nativeToken,
          usdcHolder,
          usdcAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('WETH -> USDC', async () => {
        await testE2E(
          wethToken,
          usdcToken,
          wethHolder,
          wethAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('USDC -> WETH', async () => {
        await testE2E(
          usdcToken,
          wethToken,
          usdcHolder,
          usdcAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('WBTC -> WETH', async () => {
        await testE2E(
          wbtcToken,
          wethToken,
          wbtcHolder,
          wbtcAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('LINK -> WETH', async () => {
        await testE2E(
          linkToken,
          wethToken,
          linkHolder,
          linkAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('AAVE -> WETH', async () => {
        await testE2E(
          aaveToken,
          wethToken,
          aaveHolder,
          aaveAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('CRV -> WETH', async () => {
        await testE2E(
          crvToken,
          wethToken,
          crvHolder,
          crvAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('PERP -> WETH', async () => {
        await testE2E(
          perpToken,
          wethToken,
          perpHolder,
          perpAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('USDL -> WETH', async () => {
        await testE2E(
          usdlToken,
          wethToken,
          usdlHolder,
          usdlAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('LINK -> AAVE', async () => {
        await testE2E(
          linkToken,
          aaveToken,
          linkHolder,
          linkAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('CRV -> PERP', async () => {
        await testE2E(
          crvToken,
          perpToken,
          crvHolder,
          crvAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('USDL -> WBTC', async () => {
        await testE2E(
          usdlToken,
          wbtcToken,
          usdlHolder,
          usdlAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('PERP -> AAVE', async () => {
        await testE2E(
          perpToken,
          aaveToken,
          perpHolder,
          perpAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('WBTC -> USDC', async () => {
        await testE2E(
          wbtcToken,
          usdcToken,
          wbtcHolder,
          wbtcAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('ETH -> LINK', async () => {
        await testE2E(
          nativeToken,
          linkToken,
          ethHolder,
          ethAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('USDC -> CRV', async () => {
        await testE2E(
          usdcToken,
          crvToken,
          usdcHolder,
          usdcAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });

      it('USDC -> WBTC', async () => {
        await testE2E(
          usdcToken,
          wbtcToken,
          usdcHolder,
          usdcAmount,
          side,
          dexKey,
          contractMethod,
          network,
          provider,
        );
      });
    });
  });
});
