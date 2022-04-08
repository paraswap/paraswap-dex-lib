import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import {
  Network,
  ProviderURL,
  ContractMethod,
  SwapSide,
} from '../../constants';
import { JsonRpcProvider } from '@ethersproject/providers';

describe('Nerve E2E', () => {
  describe('Nerve', () => {
    const dexKey = 'Nerve';

    describe('BSC', () => {
      const network = Network.BSC;
      const tokens = Tokens[network];
      const holders = Holders[network];
      const provider = new JsonRpcProvider(ProviderURL[network]);
      describe('simpleSwap', () => {
        const contractMethod = ContractMethod.simpleSwap;
        it('SELL BUSD -> USDC', async () => {
          await testE2E(
            tokens.BUSD,
            tokens.USDC,
            holders.BUSD,
            '11000000000000000000',
            SwapSide.SELL,
            dexKey,
            contractMethod,
            network,
            provider,
          );
        });
        it('SELL BTCB -> anyBTC', () => {});
      });
      describe('multiSwap', () => {
        it('SELL BUSD -> USDC', () => {});
        it('SELL ETH -> anyETH', () => {});
      });
      describe('megaSwap', () => {
        it('SELL BUSD -> USDC', () => {});
        it('SELL ETH -> anyETH', () => {});
      });
    });
  });

  // describe('Axial', () => {
  //   describe('simpleSwap', () => {
  //     it('TUSD -> DAI.e', async () => {
  //       await testE2E(
  //         TUSD,
  //         DAIE,
  //         holders[TUSD],
  //         '70000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.simpleSwap],
  //         DECIMALS[TUSD],
  //         DECIMALS[DAIE],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });

  //     it('TSD -> DAI.e', async () => {
  //       await testE2E(
  //         TSD,
  //         DAIE,
  //         holders[TSD],
  //         '100000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.simpleSwap],
  //         DECIMALS[TSD],
  //         DECIMALS[DAIE],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });

  //     it('MIM -> USDC.e', async () => {
  //       await testE2E(
  //         MIM,
  //         USDCe,
  //         holders[MIM],
  //         '70000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.simpleSwap],
  //         DECIMALS[MIM],
  //         DECIMALS[USDCe],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });
  //   });

  //   describe('multi', () => {
  //     it('TUSD -> DAI.e', async () => {
  //       await testE2E(
  //         TUSD,
  //         DAIE,
  //         holders[TUSD],
  //         '70000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.multiSwap],
  //         DECIMALS[TUSD],
  //         DECIMALS[DAIE],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });

  //     it('TSD -> DAI.e', async () => {
  //       await testE2E(
  //         TSD,
  //         DAIE,
  //         holders[TSD],
  //         '100000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.multiSwap],
  //         DECIMALS[TSD],
  //         DECIMALS[DAIE],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });

  //     it('MIM -> USDC.e', async () => {
  //       await testE2E(
  //         MIM,
  //         USDCe,
  //         holders[MIM],
  //         '70000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.multiSwap],
  //         DECIMALS[MIM],
  //         DECIMALS[USDCe],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });
  //   });

  //   describe('mega', () => {
  //     it('TUSD -> DAI.e', async () => {
  //       await testE2E(
  //         TUSD,
  //         DAIE,
  //         holders[TUSD],
  //         '70000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.megaSwap],
  //         DECIMALS[TUSD],
  //         DECIMALS[DAIE],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });

  //     it('TSD -> DAI.e', async () => {
  //       await testE2E(
  //         TSD,
  //         DAIE,
  //         holders[TSD],
  //         '100000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.megaSwap],
  //         DECIMALS[TSD],
  //         DECIMALS[DAIE],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });

  //     it('MIM -> USDC.e', async () => {
  //       await testE2E(
  //         MIM,
  //         USDCe,
  //         holders[MIM],
  //         '70000000000000000000',
  //         SwapSide.SELL,
  //         EXCHANGES.AXIAL,
  //         [ContractMethod.megaSwap],
  //         DECIMALS[MIM],
  //         DECIMALS[USDCe],
  //         AVALANCHE_NETWORK_ID,
  //       );
  //     });
  //   });
  // });

  // describe('Saddle', () => {
  //   it('Simpleswap: Token -> TOKEN', async () => {
  //     await testE2E(
  //       USDC,
  //       USDT,
  //       holders[USDC],
  //       '10000000000',
  //       SwapSide.SELL,
  //       'saddle',
  //       [ContractMethod.simpleSwap],
  //     );
  //   });

  //   it('MultiSwap: Token -> TOKEN', async () => {
  //     await testE2E(
  //       USDC,
  //       USDT,
  //       holders[USDC],
  //       '10000000000',
  //       SwapSide.SELL,
  //       'saddle',
  //       [ContractMethod.multiSwap],
  //     );
  //   });

  //   it('MegaSwap: Token -> TOKEN', async () => {
  //     await testE2E(
  //       USDC,
  //       USDT,
  //       holders[USDC],
  //       '10000000000',
  //       SwapSide.SELL,
  //       'saddle',
  //       [ContractMethod.megaSwap],
  //     );
  //   });
  // });

  // describe('IronV2', () => {
  //   it('Simpleswap: Token -> TOKEN', async () => {
  //     await testE2E(
  //       USDC,
  //       USDT,
  //       holders[USDC],
  //       '100000000',
  //       SwapSide.SELL,
  //       'ironv2',
  //       [ContractMethod.simpleSwap],
  //       undefined,
  //       undefined,
  //       POLYGON_NETWORK_ID,
  //     );
  //   });

  //   it('MultiSwap: Token -> TOKEN', async () => {
  //     await testE2E(
  //       DAI,
  //       USDC,
  //       holders[DAI],
  //       '100000000000000000000',
  //       SwapSide.SELL,
  //       'ironv2',
  //       [ContractMethod.multiSwap],
  //       undefined,
  //       undefined,
  //       POLYGON_NETWORK_ID,
  //     );
  //   });

  //   it('MegaSwap: Token -> TOKEN', async () => {
  //     await testE2E(
  //       USDT,
  //       DAI,
  //       holders[USDT],
  //       '1000000000',
  //       SwapSide.SELL,
  //       'ironv2',
  //       [ContractMethod.megaSwap],
  //       undefined,
  //       undefined,
  //       POLYGON_NETWORK_ID,
  //     );
  //   });
  // });
});
