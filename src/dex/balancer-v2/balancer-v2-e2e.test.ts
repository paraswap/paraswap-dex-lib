import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

jest.setTimeout(50 * 1000);

describe('BalancerV2 E2E', () => {
  describe('BalancerV2 MAINNET', () => {
    const dexKey = 'BalancerV2';
    const network = Network.MAINNET;
    const tokens = Tokens[Network.MAINNET];
    const holders = Holders[Network.MAINNET];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

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
      it('MAIN TOKEN -> BPT, ERC4626 Linear Pool', async () => {
        await testE2E(
          tokens['DAI'],
          tokens['BBFDAI'],
          holders['DAI'],
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
          '20000000',
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
      it('MAIN TOKEN -> BPT, ERC4626 Linear Pool', async () => {
        await testE2E(
          tokens['DAI'],
          tokens['BBFDAI'],
          holders['DAI'],
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

  describe('BalancerV2 ARBITRUM', () => {
    const dexKey = 'BalancerV2';
    const network = Network.ARBITRUM;
    const tokens = Tokens[Network.ARBITRUM];
    const holders = Holders[Network.ARBITRUM];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('Simpleswap', () => {
      it.only('ETH -> TOKEN', async () => {
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
    });

    describe('Multiswap', () => {
      it('ETH -> TOKEN', async () => {
        await testE2E(
          tokens['ETH'],
          tokens['USDC'],
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
          tokens['WETH'],
          holders['USDC'],
          '20000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });
  });

  // describe('Embr AVALANCHE', () => {
  //   const dexKey = 'Embr';
  //   const network = Network.AVALANCHE;
  //   const tokens = Tokens[network];
  //   const holders = Holders[network];
  //   const provider = new StaticJsonRpcProvider(
  //     generateConfig(network).privateHttpProvider,
  //     network,
  //   );
  //
  //   describe('simpleSwap', () => {
  //     it('AVAX -> USDC', async () => {
  //       await testE2E(
  //         tokens.AVAX,
  //         tokens.USDCe,
  //         holders.AVAX,
  //         '7000000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //
  //     it('USDC -> AVAX', async () => {
  //       await testE2E(
  //         tokens.USDCe,
  //         tokens.AVAX,
  //         holders.USDCe,
  //         '100000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //
  //     it('WAVAX -> USDC', async () => {
  //       await testE2E(
  //         tokens.WAVAX,
  //         tokens.USDCe,
  //         holders.WAVAX,
  //         '7000000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.simpleSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //   });
  //
  //   describe('multiSwap', () => {
  //     it('AVAX -> USDCe', async () => {
  //       await testE2E(
  //         tokens.AVAX,
  //         tokens.USDCe,
  //         holders.AVAX,
  //         '1000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.multiSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //
  //     it('USDCe -> AVAX', async () => {
  //       await testE2E(
  //         tokens.USDCe,
  //         tokens.AVAX,
  //         holders.USDCe,
  //         '100000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.multiSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //
  //     it('WAVAX -> USDCe', async () => {
  //       await testE2E(
  //         tokens.WAVAX,
  //         tokens.USDCe,
  //         holders.WAVAX,
  //         '7000000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.multiSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //   });
  //
  //   describe('megaSwap', () => {
  //     it('AVAX -> USDCe', async () => {
  //       await testE2E(
  //         tokens.AVAX,
  //         tokens.USDCe,
  //         holders.AVAX,
  //         '7000000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.megaSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //
  //     it('USDCe -> AVAX', async () => {
  //       await testE2E(
  //         tokens.USDCe,
  //         tokens.AVAX,
  //         holders.USDCe,
  //         '100000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.megaSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //
  //     it('WAVAX -> USDCe', async () => {
  //       await testE2E(
  //         tokens.WAVAX,
  //         tokens.USDCe,
  //         holders.WAVAX,
  //         '7000000000000000000',
  //         SwapSide.SELL,
  //         dexKey,
  //         ContractMethod.megaSwap,
  //         network,
  //         provider,
  //       );
  //     });
  //   });
  // });

  describe('BeetsFi FANTOM', () => {
    const dexKey = 'BeetsFi';
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    describe('simpleSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.simpleSwap,
          network,
          provider,
        );
      });
    });

    describe('multiSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.multiSwap,
          network,
          provider,
        );
      });
    });

    describe('megaSwap', () => {
      it('FTM -> USDC', async () => {
        await testE2E(
          tokens.FTM,
          tokens.USDC,
          holders.FTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('USDC -> FTM', async () => {
        await testE2E(
          tokens.USDC,
          tokens.FTM,
          holders.USDC,
          '100000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });

      it('WFTM -> USDC', async () => {
        await testE2E(
          tokens.WFTM,
          tokens.USDC,
          holders.WFTM,
          '7000000000000000000',
          SwapSide.SELL,
          dexKey,
          ContractMethod.megaSwap,
          network,
          provider,
        );
      });
    });
  });
});
