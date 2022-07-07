import { SwapSide } from 'paraswap-core';
import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network } from '../../constants';
import nervePoolABI from '../../abi/nerve/nerve-pool.json';
import axialPoolABI from '../../abi/nerve/axial-pool.json';
import ironV2PoolABI from '../../abi/nerve/iron-v2-pool.json';

export const threePoolName = 'ThreePool';

// The order of the coins must be places with the same indexes as in contracts
export const NerveConfig: DexConfigMap<DexParams> = {
  Nerve: {
    [Network.BSC]: {
      poolConfigs: {
        [threePoolName]: {
          name: threePoolName,
          address: '0x1B3771a66ee31180906972580adE9b81AFc5fCDc',
          coins: [
            {
              address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // 0 - BUSD
              decimals: 18,
            },
            {
              address: '0x55d398326f99059fF775485246999027B3197955', // 1 - USDT
              decimals: 18,
            },
            {
              address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 2 - USDC
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xf2511b5E4FB0e5E2d123004b672BA14850478C14',
            decimals: 18,
          },
        },
        BTC: {
          name: 'BTC',
          address: '0x6C341938bB75dDe823FAAfe7f446925c66E6270c',
          coins: [
            {
              address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // 0 - bBTC
              decimals: 18,
            },
            {
              address: '0x54261774905f3e6E9718f2ABb10ed6555cae308a', // 1 - anyBTC
              decimals: 8,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0xD1D5Af92C606C6F2eC59D453f57A6FCc188D7dB5',
            decimals: 18,
          },
        },
        ETH: {
          name: 'ETH',
          address: '0x146CD24dCc9f4EB224DFd010c5Bf2b0D25aFA9C0',
          coins: [
            {
              address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // 0 - bETH
              decimals: 18,
            },
            {
              address: '0x6F817a0cE8F7640Add3bC0c1C2298635043c2423', // 1 - anyETH
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0x0d283BF16A9bdE49cfC48d8dc050AF28b71bdD90',
            decimals: 18,
          },
        },
        // fUSDT: {
        //   name: 'fUSDT',
        //   address: '0xd0fBF0A224563D5fFc8A57e4fdA6Ae080EbCf3D3',
        //   coins: [
        //     '0x049d68029688eAbF473097a2fC38ef61633A3C7A', // 0 - fUSDT
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x2e91A0CECf28c5E518bB2E7fdcd9F8e2cd511c10',
        // },
        // UST: {
        //   name: 'UST',
        //   address: '0x2dcCe1586b1664f41C72206900e404Ec3cA130e0',
        //   coins: [
        //     '0x23396cF899Ca06c4472205fC903bDB4de249D6fC', // 0 - wUST
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x35Ce243e0DC9eD77e3C348Bb2742095F78e1Cb70',
        // },
        // rUSD: {
        //   name: 'rUSD',
        //   address: '0x0eafaa7ed9866c1f08ac21dd0ef3395e910f7114',
        //   coins: [
        //     '0x07663837218A003e66310a01596af4bf4e44623D', // 0 - rUSD
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x870ee4d19c12A789c61de69E3E5eFb42383E4434',
        // },
      },
      abi: nervePoolABI,
    },
  },
  Axial: {
    [Network.AVALANCHE]: {
      poolConfigs: {
        AS4D: {
          name: 'AS4D',
          address: '0x2a716c4933A20Cd8B9f9D9C39Ae7196A85c24228',
          coins: [
            {
              address: '0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB', // 0 - TUSD
              decimals: 18,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 1 - USDC.e
              decimals: 6,
            },
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 2 - DAI.e
              decimals: 18,
            },
            {
              address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', // 3 - USDT.e
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x3a7387f8ba3ebffa4a0eccb1733e940ce2275d3f',
            decimals: 18,
          },
        },
        AC4D: {
          name: 'AC4D',
          address: '0x8c3c1C6F971C01481150CA7942bD2bbB9Bc27bC7',
          coins: [
            {
              address: '0x4fbf0429599460D327BD5F55625E30E4fC066095', // 0 - TSD
              decimals: 18,
            },
            {
              address: '0x130966628846BFd36ff31a822705796e8cb8C18D', // 1 - MIM
              decimals: 18,
            },
            {
              address: '0xD24C2Ad096400B6FBcd2ad8B24E7acBc21A1da64', // 2 - FRAX
              decimals: 18,
            },
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 3 - DAI.e
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x4da067E13974A4d32D342d86fBBbE4fb0f95f382',
            decimals: 18,
          },
        },
        AM3D: {
          name: 'AM3D',
          address: '0x90c7b96AD2142166D001B27b5fbc128494CDfBc8',
          coins: [
            {
              address: '0x130966628846BFd36ff31a822705796e8cb8C18D', // 0 - MIM
              decimals: 18,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 1 - USDC.e
              decimals: 6,
            },
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 2 - DAI.e
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xc161E4B11FaF62584EFCD2100cCB461A2DdE64D1',
            decimals: 18,
          },
        },
        AA3D: {
          name: 'AA3D',
          address: '0x6EfbC734D91b229BE29137cf9fE531C1D3bf4Da6',
          coins: [
            {
              address: '0x346A59146b9b4a77100D369a3d18E8007A9F46a6', // 0 - AVAI
              decimals: 18,
            },
            {
              address: '0x130966628846BFd36ff31a822705796e8cb8C18D', // 1 - MIM
              decimals: 18,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 2 - USDC.e
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xaD556e7dc377d9089C6564f9E8d275f5EE4da22d',
            decimals: 18,
          },
        },
        SCALES: {
          name: 'SCALES',
          address: '0xfD24d41B7C4C7C8Cd363Dd3FF6f49C99c8280430',
          coins: [
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 0 - DAI.e
              decimals: 18,
            },
            {
              address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', // 1 - USDT.e
              decimals: 6,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 2 - USDC.e
              decimals: 6,
            },
            {
              address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // 3 - USDC
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x556FB44205549c115e83A58d91522B14340Fb8d3',
            decimals: 18,
          },
        },
        HERO: {
          name: 'HERO',
          address: '0xa0f6397FEBB03021F9BeF25134DE79835a24D76e',
          coins: [
            {
              address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // 0 - USDC
              decimals: 6,
            },
            {
              address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', // 1 - USDT
              decimals: 6,
            },
            {
              address: '0x130966628846BFd36ff31a822705796e8cb8C18D', // 2 - MIM
              decimals: 18,
            },
            {
              address: '0x111111111111ed1D73f860F57b2798b683f2d325', // 3 - YUSD
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x73fA690aE97CdE1426d144E5f7406895fEa715E4',
            decimals: 18,
          },
        },
      },
      abi: axialPoolABI,
    },
  },
  IronV2: {
    [Network.POLYGON]: {
      poolConfigs: {
        IS3USD_POLYGON: {
          name: 'IS3USD_POLYGON',
          address: '0x837503e8A8753ae17fB8C8151B8e6f586defCb57',
          coins: [
            {
              address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // 0 - USDC
              decimals: 6,
            },
            {
              address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // 1 - USDT
              decimals: 6,
            },
            {
              address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // 2 - DAI
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xb4d09ff3dA7f9e9A2BA029cb0A81A989fd7B8f17',
            decimals: 18,
          },
        },
      },
      abi: ironV2PoolABI,
    },
    [Network.AVALANCHE]: {
      poolConfigs: {
        IS3USD_AVALANCHE: {
          name: 'IS3USD_AVALANCHE',
          address: '0x952BDA8A83c3D5F398a686bb4e8C6DD90072d523',
          coins: [
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 0 - USDC.e
              decimals: 6,
            },
            {
              address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', // 1 - USDT.e
              decimals: 6,
            },
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 2 - DAI
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xfC108f21931576a21D0b4b301935DAc80d9E5086',
            decimals: 18,
          },
        },
      },
      abi: ironV2PoolABI,
    },
    [Network.FANTOM]: {
      poolConfigs: {
        IS3USD_FANTOM: {
          name: 'IS3USD_FANTOM',
          address: '0x952BDA8A83c3D5F398a686bb4e8C6DD90072d523',
          coins: [
            {
              address: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', // 0 - USDC
              decimals: 6,
            },
            {
              address: '0x049d68029688eAbF473097a2fC38ef61633A3C7A', // 0 - fUSDT
              decimals: 6,
            },
            {
              address: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E', // 0 - DAI
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x260b3e40c714ce8196465ec824cd8bb915081812',
            decimals: 18,
          },
        },
      },
      abi: ironV2PoolABI,
    },
  },
  Saddle: {
    [Network.MAINNET]: {
      poolConfigs: {
        D4: {
          name: 'D4',
          address: '0xC69DDcd4DFeF25D8a793241834d4cc4b3668EAD6',
          coins: [
            {
              address: '0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9', // 0 - alUSD
              decimals: 18,
            },
            {
              address: '0x956F47F50A910163D8BF957Cf5846D573E7f87CA', // 1 - FEI
              decimals: 18,
            },
            {
              address: '0x853d955aCEf822Db058eb8505911ED77F175b99e', // 2 - FRAX
              decimals: 18,
            },
            {
              address: '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0', // 3 - LUSD
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xd48cF4D7FB0824CC8bAe055dF3092584d0a1726A',
            decimals: 18,
          },
        },
        BTCV2: {
          name: 'BTCV2',
          address: '0xdf3309771d2BF82cb2B6C56F9f5365C8bD97c4f2',
          coins: [
            {
              address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // 0 - WBTC
              decimals: 8,
            },
            {
              address: '0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D', // 1 - renBTC
              decimals: 8,
            },
            {
              address: '0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6', // 2 - sBTC
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0xF32E91464ca18fc156aB97a697D6f8ae66Cd21a3',
            decimals: 18,
          },
        },
        alETH: {
          name: 'alETH',
          address: '0xa6018520EAACC06C30fF2e1B3ee2c7c22e64196a',
          coins: [
            {
              address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // 0 - WETH
              decimals: 18,
            },
            {
              address: '0x0100546F2cD4C9D97f798fFC9755E47865FF7Ee6', // 1 - alETH
              decimals: 18,
            },
            {
              address: '0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb', // 2 - sETH
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0xc9da65931ABf0Ed1b74Ce5ad8c041C4220940368',
            decimals: 18,
          },
        },
        StablecoinV2: {
          name: 'StablecoinV2',
          address: '0xaCb83E0633d6605c5001e2Ab59EF3C745547C8C7',
          coins: [
            {
              address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // 0 - DAI
              decimals: 18,
            },
            {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // 1 - USDC
              decimals: 6,
            },
            {
              address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // 2 - USDT
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x5f86558387293b6009d7896A61fcc86C17808D62',
            decimals: 18,
          },
        },
      },
      // The same as axial
      abi: axialPoolABI,
    },
    [Network.FANTOM]: {
      poolConfigs: {
        FtmUSD: {
          name: 'FtmUSD',
          address: '0xBea9F78090bDB9e662d8CB301A00ad09A5b756e9',
          coins: [
            {
              address: '0xdc301622e621166BD8E82f2cA0A26c13Ad0BE355', // 0 - FRAX
              decimals: 18,
            },
            {
              address: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', // 1 - USDC
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xc969dd0a7ab0f8a0c5a69c0839db39b6c928bc08',
            decimals: 18,
          },
        },
      },
      // The same as axial
      abi: axialPoolABI,
    },
    [Network.ARBITRUM]: {
      poolConfigs: {
        arbUSD: {
          name: 'arbUSD',
          address: '0xBea9F78090bDB9e662d8CB301A00ad09A5b756e9',
          coins: [
            {
              address: '0x2913E812Cf0dcCA30FB28E6Cac3d2DCFF4497688', // 0 - nUSD
              decimals: 18,
            },
            {
              address: '0xFEa7a6a0B346362BF88A9e4A88416B77a57D6c2A', // 1 - MIM
              decimals: 18,
            },
            {
              address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // 2 - USDC
              decimals: 6,
            },
            {
              address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // 3 - USDT
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xc969dD0A7AB0F8a0C5A69C0839dB39b6C928bC08',
            decimals: 18,
          },
        },
        arbUSDV2: {
          name: 'arbUSDV2',
          address: '0xfeEa4D1BacB0519E8f952460A70719944fe56Ee0',
          coins: [
            {
              address: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F', // 0 - FRAX
              decimals: 18,
            },
            {
              address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // 1 - USDC
              decimals: 6,
            },
            {
              address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // 2 - USDT
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x0a20c2FFa10cD43F67D06170422505b7D6fC0953',
            decimals: 18,
          },
        },
        // TODO: This pool doesn't have liquidity and I don't know the addresses. We can add it later at some time
        // FraxUsdcBp: {
        //   name: 'FraxUsdcBp',
        //   address: '',
        //   coins: [
        //     {
        //       address: '', // 0 - FRAX
        //       decimals: 0,
        //     },
        //   ],
        //   isMetapool: false,
        //   isUSDPool: true,
        //   lpToken: {
        //     address: '',
        //     decimals: 0,
        //   },
        // },
      },

      // The same as axial
      abi: axialPoolABI,
    },
  },
  Synapse: {
    // TODO: Add configs for all other networks for Synapse
    // [Network.MAINNET]: {
    //   poolConfigs: {},
    //   abi: axialPoolABI,
    // },
    // [Network.BSC]: {
    //   poolConfigs: {},
    //   abi: axialPoolABI,
    // },
    // [Network.POLYGON]: {
    //   poolConfigs: {},
    //   abi: axialPoolABI,
    // },
    // [Network.FANTOM]: {
    //   poolConfigs: {},
    //   abi: axialPoolABI,
    // },
    // [Network.AVALANCHE]: {
    //   poolConfigs: {},
    //   abi: axialPoolABI,
    // },
    // TODO: Not giving correct prices
    // [Network.ARBITRUM]: {
    //   poolConfigs: {
    //     ArbETHPool: {
    //       name: 'ArbETHPool',
    //       address: '0xa067668661C84476aFcDc6fA5D758C4c01C34352',
    //       coins: [
    //         {
    //           address: '0x3ea9B0ab55F34Fb188824Ee288CeaEfC63cf908e', // 0 - nETH
    //           decimals: 18,
    //         },
    //         {
    //           address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // 1 - WETH
    //           decimals: 18,
    //         },
    //       ],
    //       isMetapool: false,
    //       isUSDPool: false,
    //       lpToken: {
    //         address: '0xD70A52248e546A3B260849386410C7170c7BD1E9',
    //         decimals: 18,
    //       },
    //     },
    //     nUSDV2: {
    //       name: 'nUSDV2',
    //       address: '0x0Db3FE3B770c95A0B99D1Ed6F2627933466c0Dd8',
    //       coins: [
    //         {
    //           address: '0x2913E812Cf0dcCA30FB28E6Cac3d2DCFF4497688', // 0 - nUSD
    //           decimals: 18,
    //         },
    //         {
    //           address: '0xFEa7a6a0B346362BF88A9e4A88416B77a57D6c2A', // 1 - MIM
    //           decimals: 18,
    //         },
    //         {
    //           address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // 2 - USDC
    //           decimals: 6,
    //         },
    //         {
    //           address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // 3 - USDT
    //           decimals: 6,
    //         },
    //       ],
    //       isMetapool: false,
    //       isUSDPool: true,
    //       lpToken: {
    //         address: '0xADeac0343C2Ac62DFE5A5f51E896AefFF5Ab513E',
    //         decimals: 18,
    //       },
    //     },
    //     nUSDV3: {
    //       name: 'nUSDV3',
    //       address: '0x9Dd329F5411466d9e0C488fF72519CA9fEf0cb40',
    //       coins: [
    //         {
    //           address: '0x2913E812Cf0dcCA30FB28E6Cac3d2DCFF4497688', // 0 - nUSD
    //           decimals: 18,
    //         },
    //         {
    //           address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // 1 - USDC
    //           decimals: 6,
    //         },
    //         {
    //           address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // 2 - USDT
    //           decimals: 6,
    //         },
    //       ],
    //       isMetapool: false,
    //       isUSDPool: true,
    //       lpToken: {
    //         address: '0xcFd72be67Ee69A0dd7cF0f846Fc0D98C33d60F16',
    //         decimals: 18,
    //       },
    //     },
    //   },
    //   abi: axialPoolABI,
    // },
  },
};

export const NERVE_GAS_COST = 200 * 1000;

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 4 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 3 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 7 }],
  },
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter02', index: 8 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 7 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 8 }],
  },
};
