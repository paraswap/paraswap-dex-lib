import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { JsonRpcProvider } from '@ethersproject/providers';

jest.setTimeout(50 * 1000);

describe('BalancerV2 E2E', () => {
  describe('BalancerV2 MAINNET', () => {
    const dexKey = 'BalancerV2';
    const network = Network.MAINNET;
    const tokens = Tokens[Network.MAINNET];
    const holders = Holders[Network.MAINNET];
    const provider = new JsonRpcProvider(ProviderURL[network]);

    describe('Simpleswap', () => {
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['USDC'],
          holders['ETH'],
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WETH'],
          holders['USDC'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('MAIN TOKEN -> BPT, LinearPool', async () => {
        // Linear Pools allow swaps between main token (i.e. USDT) and pools BPT
        await testE2E(
          tokens['USDT'],
          tokens['BBAUSDT'],
          holders['USDT'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      it('MAIN TOKEN -> WRAPPED TOKEN, LinearPool', async () => {
        await testE2E(
          tokens['USDT'],
          tokens['waUSDT'],
          holders['USDT'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
      // NO HOLDERS OF waUSDT (ONLY VAULT)
      // it('WRAPPED TOKEN -> BPT, LinearPool', async () => {
      //   // Linear Pools allow swaps between wrapped token (i.e. waUSDT) and pools BPT
      //   await testE2E(
      //     tokens['waUSDT'],
      //     tokens['BBAUSDT'],
      //     holders['waUSDT'],
      //     '20000000',
      //     SwapSide.SELL,
      //     dexKey,
      //     ContractMethod.simpleSwap,
      //     network,
      //     provider,
      //   );
      // });
      // NO HOLDERS OF BBADAI (ONLY VAULT)
      // it('WRAPPED TOKEN -> MAIN TOKEN, LinearPool', async () => {
      //   await testE2E(
      //     tokens['waUSDT'],
      //     tokens['BBAUSDT'],
      //     holders['waUSDT'],
      //     '20000000',
      //     SwapSide.SELL,
      //     dexKey,
      //     ContractMethod.simpleSwap,
      //     network,
      //     provider,
      //   );
      // });
      // NO HOLDERS OF BBADAI (ONLY VAULT)
      // it('BPT -> MAIN TOKEN, LinearPool', async () => {
      //   // Linear Pools allow swaps between main token (i.e. USDT) and pools BPT
      //   await testE2E(
      //     tokens['BBADAI'],
      //     tokens['DAI'],
      //     holders['BBADAI'],
      //     '20000000',
      //     SwapSide.SELL,
      //     dexKey,
      //     ContractMethod.simpleSwap,
      //     network,
      //     provider,
      //   );
      // });
      // it('BPT -> WRAPPED TOKEN, LinearPool', async () => {
      //   // Linear Pools allow swaps between wrapped token (i.e. waDAI) and pools BPT
      //   await testE2E(
      //     tokens['BBADAI'],
      //     tokens['waDAI'],
      //     holders['BBADAI'],
      //     '20000000',
      //     SwapSide.SELL,
      //     dexKey,
      //     ContractMethod.simpleSwap,
      //     network,
      //     provider,
      //   );
      // });
      it('BPT -> TOKEN, PhantomStablePool', async () => {
        // PhamtomStable allows swaps between BPT and tokens
        await testE2E(
          tokens['BBAUSD'],
          tokens['BBADAI'],
          holders['BBAUSD'],
          '20000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('Multiswap', () => {
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['WBTC'],
          holders['ETH'],
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> ETH', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['ETH'],
          holders['USDC'],
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('TOKEN -> TOKEN', async () => {
        await testE2E(
          tokens['USDC'],
          tokens['WBTC'],
          holders['USDC'],
          '2000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('MAIN TOKEN -> BPT, LinearPool', async () => {
        // Linear Pools allow swaps between main token (i.e. USDT) and pools BPT
        await testE2E(
          tokens['USDT'],
          tokens['BBAUSDT'],
          holders['USDT'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('MAIN TOKEN -> WRAPPED TOKEN, LinearPool', async () => {
        await testE2E(
          tokens['USDT'],
          tokens['waUSDT'],
          holders['USDT'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
      it('BPT -> TOKEN, PhantomStablePool', async () => {
        // PhamtomStable allows swaps between BPT and tokens
        await testE2E(
          tokens['BBAUSD'],
          tokens['BBAUSDT'],
          holders['BBAUSD'],
          '20000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    //BUY is not currently supported for BalancerV2
    //describe('SimpleBuy', () => {
    //  it('ETH -> TOKEN buy', async () => {
    //    await testE2E(
    //      tokens['ETH'],
    //      tokens['WBTC'],
    //      holders['ETH'],
    //      '35000000',
    //      SwapSide.BUY,
    //      dexKey,
    //      ContractMethod.simpleBuy,
    //      network,
    //      provider,
    //    );
    //  });
    //  it('TOKEN -> ETH buy', async () => {
    //    await testE2E(
    //      tokens['USDC'],
    //      tokens['ETH'],
    //      holders['USDC'],
    //      '1000000000000000000',
    //      SwapSide.BUY,
    //      dexKey,
    //      ContractMethod.simpleBuy,
    //      network,
    //      provider,
    //    );
    //  });
    //  it('TOKEN -> TOKEN buy', async () => {
    //    await testE2E(
    //      tokens['USDC'],
    //      tokens['WETH'],
    //      holders['USDC'],
    //      '1000000000000000000',
    //      SwapSide.BUY,
    //      dexKey,
    //      ContractMethod.simpleBuy,
    //      network,
    //      provider,
    //    );
    //  });
    //});
  });
});
