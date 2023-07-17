import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

describe('CurveV1 E2E', () => {
  const dexKey = 'CurveV1';

  describe('CurveV1 MAINNET', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokensToTest = [
      [
        {
          symbol: 'USDT',
          amount: (10 ** 8).toString(),
        },
        {
          symbol: 'DAI',
          amount: (10 ** 8).toString(),
        },
      ],
      [
        {
          symbol: 'CUSDC',
          amount: (10 ** 8).toString(),
        },
        {
          symbol: 'CDAI',
          amount: (10 ** 8).toString(),
        },
      ],
      [
        {
          symbol: 'ETH',
          amount: '5000000000000000000',
        },
        {
          symbol: 'wBETH',
          amount: '1000000000000000',
        },
      ],
      [
        {
          symbol: 'ETH',
          amount: '5000000000000000000',
        },
        {
          symbol: 'frxETH',
          amount: '1000000000000000',
        },
      ]
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        tokensToTest.forEach(pair => {
          describe(`${contractMethod}`, () => {
            it(`${pair[0].symbol} -> ${pair[1].symbol}`, async () => {
              await testE2E(
                tokens[pair[0].symbol],
                tokens[pair[1].symbol],
                holders[pair[0].symbol],
                side === SwapSide.SELL ? pair[0].amount : pair[1].amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${pair[1].symbol} -> ${pair[0].symbol}`, async () => {
              await testE2E(
                tokens[pair[1].symbol],
                tokens[pair[0].symbol],
                holders[pair[1].symbol],
                side === SwapSide.SELL ? pair[0].amount : pair[1].amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
    it('simpleSwap DAI -> USDT', async () => {
      await testE2E(
        tokens['DAI'],
        tokens['USDT'],
        holders['DAI'],
        '100000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
    describe('FeeOnTransfer', () => {
      describe('sell', () => {
        const contractMethod = ContractMethod.megaSwap;
        describe('megaSwap', () => {
          it('stETH -> ETH', async () => {
            await testE2E(
              tokens['STETH'],
              tokens['ETH'],
              holders['STETH'],
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              contractMethod,
              network,
              provider,
              undefined,
              undefined,
              { srcFee: 1, destFee: 0, srcDexFee: 1, destDexFee: 0 },
            );
          });

          it('ETH -> stETH', async () => {
            await testE2E(
              tokens['ETH'],
              tokens['STETH'],
              holders['ETH'],
              '1000000000000000000',
              SwapSide.SELL,
              dexKey,
              contractMethod,
              network,
              provider,
              undefined,
              undefined,
              { srcFee: 0, destFee: 1, srcDexFee: 0, destDexFee: 1 },
            );
          });
        });
      });
    });
  });

  describe('CurveV1 POLYGON', () => {
    const network = Network.POLYGON;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokensToTest = [
      [
        {
          symbol: 'USDT',
          amount: (10 ** 8).toString(),
        },
        {
          symbol: 'DAI',
          amount: (10 ** 8).toString(),
        },
      ],
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
          ContractMethod.directCurveV1Swap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        tokensToTest.forEach(pair => {
          describe(`${contractMethod}`, () => {
            it(`${pair[0].symbol} -> ${pair[1].symbol}`, async () => {
              await testE2E(
                tokens[pair[0].symbol],
                tokens[pair[1].symbol],
                holders[pair[0].symbol],
                side === SwapSide.SELL ? pair[0].amount : pair[1].amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
  });

  describe('FANTOM', () => {
    const network = Network.FANTOM;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokensToTest = [
      [
        {
          symbol: 'DAI',
          amount: (10 ** 18).toString(),
        },
        {
          symbol: 'USDC',
          amount: (10 ** 6).toString(),
        },
      ],
      [
        {
          symbol: 'DAI',
          amount: (10 ** 18).toString(),
        },
        {
          symbol: 'FUSDT',
          amount: (10 ** 6).toString(),
        },
      ],
      [
        {
          symbol: 'GDAI',
          amount: (10 ** 18).toString(),
        },
        {
          symbol: 'GUSDC',
          amount: (10 ** 6).toString(),
        },
      ],
    ];

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        tokensToTest.forEach(pair => {
          describe(`${contractMethod}`, () => {
            it(`${pair[0].symbol} -> ${pair[1].symbol}`, async () => {
              await testE2E(
                tokens[pair[0].symbol],
                tokens[pair[1].symbol],
                holders[pair[0].symbol],
                side === SwapSide.SELL ? pair[0].amount : pair[1].amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
    it('simpleSwap DAI -> USDC', async () => {
      await testE2E(
        tokens['DAI'],
        tokens['USDC'],
        holders['DAI'],
        '100000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
  });
});

describe('Acryptos E2E', () => {
  const dexKey = 'Acryptos';

  describe('Acryptos BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'USDT';
    const tokenBSymbol: string = 'DAI';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('TOKEN -> TOKEN', async () => {
            await testE2E(
              tokens[tokenASymbol],
              tokens[tokenBSymbol],
              holders[tokenASymbol],
              side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
        });
      }),
    );
  });
});

describe('Ellipsis E2E', () => {
  const dexKey = 'Ellipsis';

  describe('Ellipsis BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'BUSD';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('TOKEN -> TOKEN', async () => {
            await testE2E(
              tokens[tokenASymbol],
              tokens[tokenBSymbol],
              holders[tokenASymbol],
              side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
        });
      }),
    );
    it('SELL BUSD -> axlUSD', async () => {
      await testE2E(
        tokens['BUSD'],
        tokens['axlUSD'],
        holders['BUSD'],
        '1000000000000000000',
        SwapSide.SELL,
        dexKey,
        ContractMethod.simpleSwap,
        network,
        provider,
      );
    });
  });
});

describe('Beltfi E2E', () => {
  const dexKey = 'Beltfi';

  describe('Beltfi BSC', () => {
    const network = Network.BSC;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'BUSD';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('TOKEN -> TOKEN', async () => {
            await testE2E(
              tokens[tokenASymbol],
              tokens[tokenBSymbol],
              holders[tokenASymbol],
              side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
        });
      }),
    );
  });
});

describe('Swerve E2E', () => {
  const dexKey = 'Swerve';

  describe('Swerve Mainnet', () => {
    const network = Network.MAINNET;
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokenASymbol: string = 'USDT';
    const tokenBSymbol: string = 'USDC';

    const tokenAAmount: string = (1 * 10 ** 8).toString();
    const tokenBAmount: string = (1 * 10 ** 8).toString();

    const sideToContractMethods = new Map([
      [
        SwapSide.SELL,
        [
          ContractMethod.simpleSwap,
          ContractMethod.multiSwap,
          ContractMethod.megaSwap,
        ],
      ],
    ]);

    sideToContractMethods.forEach((contractMethods, side) =>
      contractMethods.forEach((contractMethod: ContractMethod) => {
        describe(`${contractMethod}`, () => {
          it('TOKEN -> TOKEN', async () => {
            await testE2E(
              tokens[tokenASymbol],
              tokens[tokenBSymbol],
              holders[tokenASymbol],
              side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
              side,
              dexKey,
              contractMethod,
              network,
              provider,
            );
          });
        });
      }),
    );
  });
});
