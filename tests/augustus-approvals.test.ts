import dotenv from 'dotenv';
dotenv.config();

import { Network, SwapSide } from '../src/constants';
import { DummyDexHelper } from '../src/dex-helper';
import { AugustusApprovals } from '../src/dex/augustus-approvals';
import { testE2E } from './utils-e2e';
import { Tokens, Holders, NativeTokenSymbols } from './constants-e2e';
import { ContractMethodV6, OptimalRate } from '@paraswap/core';
import { generateConfig } from '../src/config';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { runE2ETest } from './v6/utils-e2e-v6';

// set timeout to 2 min
jest.setTimeout(120000);

describe('Augustus Approvals', function () {
  describe('test', () => {
    const contractAddresses = {
      AugustusV6: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
      Executor01: '0xD4B117E831e8BF3D609A8d0D9E426a5cf1fd081D',
      Executor02: '0xa1d080288A5C8426c35fb9C869D3d90765362736',
      Executor03: '0x101187C6B3306d517b9062af624F0B3C86975a9f',
    };

    const spender = '0xd4b117e831e8bf3d609a8d0d9e426a5cf1fd081d';
    const network = Network.POLYGON;
    const dexHelper = new DummyDexHelper(network);
    const augustusApprovals = new AugustusApprovals(dexHelper);

    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    const tokens = Tokens[network];
    const holders = Holders[network];
    const nativeTokenSymbol = NativeTokenSymbols[network];

    const tokenTargetMapping: [string, string][] = [
      // [
      //   '0x628a3b2e302c7e896acc432d2d0dd22b6cb9bc88',
      //   '0xf9234cb08edb93c0d4a4d4c70cc3ffd070e78e07',
      // ],
      // [
      //   '0xdac4ae188ace3c8985765edc6c9b4739d4845ddc',
      //   '0xf9234cb08edb93c0d4a4d4c70cc3ffd070e78e07',
      // ],
      // [
      //   '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      //   '0x1b81d678ffb9c0263b24a97847620c99d213eb14',
      // ],
      [
        '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        '0xfc736f39579b25bdcccaac9bca34d3528b88f1be',
      ],
    ];

    it('default', async function () {
      const res = await augustusApprovals.hasApprovals(
        spender,
        tokenTargetMapping,
      );
      console.log(res);
      // expect(res).toEqual([true, false, true]);
      // const res1 = await augustusApprovals.hasAllowance(
      //   spender,
      //   tokenTargetMapping,
      // );
      // console.log(res1);
      // const res2 = await augustusApprovals.hasAllowance(
      //   spender,
      //   tokenTargetMapping,
      // );
      // console.log(res2);
    });

    it('MATIC -> NEAR', async () => {
      const tokenASymbol = 'NEAR';
      const amount = '4435029160405886599';

      await testE2E(
        tokens[nativeTokenSymbol],
        tokens[tokenASymbol],
        holders[nativeTokenSymbol],
        amount,
        SwapSide.SELL,
        'QuickSwap',
        ContractMethodV6.swapExactAmountIn,
        network,
        provider,
      );
    });

    it('DUCKIES -> MATIC', async () => {
      const tokenASymbol = 'DUCKIES';
      const amount = '6000000000';

      await testE2E(
        tokens[tokenASymbol],
        tokens[nativeTokenSymbol],
        holders[tokenASymbol],
        amount,
        SwapSide.SELL,
        ['UniswapV3', 'SushiSwap'],
        ContractMethodV6.swapExactAmountIn,
        network,
        provider,
      );
    });

    it('new: DUCKIES => MATIC', async () => {
      const route = {
        blockNumber: 54019865,
        priceRoute: {
          blockNumber: 54019855,
          network: 137,
          srcToken: '0x18e73a5333984549484348a94f4d219f4fab7b81',
          srcDecimals: 8,
          srcAmount: '6000000000',
          destToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          destDecimals: 18,
          destAmount: '412401870835858902',
          bestRoute: [
            {
              percent: 100,
              swaps: [
                {
                  srcToken: '0x18e73a5333984549484348a94f4d219f4fab7b81',
                  srcDecimals: 8,
                  destToken: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
                  destDecimals: 6,
                  swapExchanges: [
                    {
                      exchange: 'UniswapV3',
                      srcAmount: '6000000000',
                      destAmount: '435255',
                      percent: 100,
                      poolAddresses: [
                        '0x046bbdd927fc635dd6de7cf4efdad3e767274074',
                      ],
                      data: {
                        path: [
                          {
                            tokenIn:
                              '0x18e73a5333984549484348a94f4d219f4fab7b81',
                            tokenOut:
                              '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
                            fee: '3000',
                            currentFee: '3000',
                          },
                        ],
                        gasUSD: '0.009323',
                      },
                    },
                  ],
                },
                {
                  srcToken: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
                  srcDecimals: 6,
                  destToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                  destDecimals: 18,
                  swapExchanges: [
                    {
                      exchange: 'SushiSwap',
                      srcAmount: '435255',
                      destAmount: '412401870835858902',
                      percent: 100,
                      poolAddresses: [
                        '0x55FF76BFFC3Cdd9D5FdbBC2ece4528ECcE45047e',
                      ],
                      data: {
                        router: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
                        path: [
                          '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
                          '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                        ],
                        factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
                        initCode:
                          '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
                        feeFactor: 10000,
                        pools: [
                          {
                            address:
                              '0x55FF76BFFC3Cdd9D5FdbBC2ece4528ECcE45047e',
                            fee: 30,
                            direction: false,
                          },
                        ],
                        gasUSD: '0.007698',
                      },
                    },
                  ],
                },
              ],
            },
          ],
          gasCostUSD: '0.022256',
          gasCost: '260190',
          side: 'SELL',
          version: '6',
          contractAddress: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
          tokenTransferProxy: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
          contractMethod: 'swapExactAmountIn',
          partnerFee: 0,
          srcUSD: '0.4314036000',
          destUSD: '0.4354963756',
          partner: 'paraswap.io',
          maxImpactReached: false,
          hmac: 'ec272b0d210992f6268938b2371cd78d9e47e77d',
        },
        userAddress: '0x3b4512e84017EC2dbc24e97006b47318807E1d3F',
      };

      await runE2ETest(
        route.priceRoute as OptimalRate,
        route.userAddress,
        contractAddresses,
        route.blockNumber,
      );
    });

    it('new: AAVE => BiFi', async () => {
      const route = {
        blockNumber: 54018955,
        priceRoute: {
          blockNumber: 54018940,
          network: 137,
          srcToken: '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
          srcDecimals: 18,
          srcAmount: '86373798694287743',
          destToken: '0xfbdd194376de19a88118e84e279b977f165d01b8',
          destDecimals: 18,
          destAmount: '306869279210388729',
          bestRoute: [
            {
              percent: 62,
              swaps: [
                {
                  srcToken: '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
                  srcDecimals: 18,
                  destToken: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
                  destDecimals: 6,
                  swapExchanges: [
                    {
                      exchange: 'UniswapV3',
                      srcAmount: '53551755190458401',
                      destAmount: '5573916',
                      percent: 100,
                      poolAddresses: [
                        '0xa236278bec0e0677a48527340cfb567b4e6e9adc',
                      ],
                      data: {
                        path: [
                          {
                            tokenIn:
                              '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
                            tokenOut:
                              '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
                            fee: '3000',
                            currentFee: '3000',
                          },
                        ],
                        gasUSD: '0.010387',
                      },
                    },
                  ],
                },
                {
                  srcToken: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
                  srcDecimals: 6,
                  destToken: '0xfbdd194376de19a88118e84e279b977f165d01b8',
                  destDecimals: 18,
                  swapExchanges: [
                    {
                      exchange: 'SushiSwap',
                      srcAmount: '5573916',
                      destAmount: '190098730969317426',
                      percent: 100,
                      poolAddresses: [
                        '0x180237bd326d5245D0898336F54b3c8012c5c62f',
                      ],
                      data: {
                        router: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
                        path: [
                          '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
                          '0xfbdd194376de19a88118e84e279b977f165d01b8',
                        ],
                        factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
                        initCode:
                          '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
                        feeFactor: 10000,
                        pools: [
                          {
                            address:
                              '0x180237bd326d5245D0898336F54b3c8012c5c62f',
                            fee: 30,
                            direction: true,
                          },
                        ],
                        gasUSD: '0.008577',
                      },
                    },
                  ],
                },
              ],
            },
            {
              percent: 38,
              swaps: [
                {
                  srcToken: '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
                  srcDecimals: 18,
                  destToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                  destDecimals: 18,
                  swapExchanges: [
                    {
                      exchange: 'UniswapV3',
                      srcAmount: '32822043503829342',
                      destAmount: '3271114311470744968',
                      percent: 100,
                      poolAddresses: [
                        '0xb3866eb993e1aef93f219c3da0a71c3f11becbf2',
                      ],
                      data: {
                        path: [
                          {
                            tokenIn:
                              '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
                            tokenOut:
                              '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                            fee: '500',
                            currentFee: '500',
                          },
                        ],
                        gasUSD: '0.010387',
                      },
                    },
                  ],
                },
                {
                  srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                  srcDecimals: 18,
                  destToken: '0xfbdd194376de19a88118e84e279b977f165d01b8',
                  destDecimals: 18,
                  swapExchanges: [
                    {
                      exchange: 'WaultFinance',
                      srcAmount: '3271114311470744968',
                      destAmount: '116770548241071303',
                      percent: 100,
                      poolAddresses: [
                        '0xE60afed80406190C3AB2C17501d417097Dd741DB',
                      ],
                      data: {
                        router: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
                        path: [
                          '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                          '0xfbdd194376de19a88118e84e279b977f165d01b8',
                        ],
                        factory: '0xa98ea6356A316b44Bf710D5f9b6b4eA0081409Ef',
                        initCode:
                          '0x1cdc2246d318ab84d8bc7ae2a3d81c235f3db4e113f4c6fdc1e2211a9291be47',
                        feeFactor: 10000,
                        pools: [
                          {
                            address:
                              '0xE60afed80406190C3AB2C17501d417097Dd741DB',
                            fee: 20,
                            direction: true,
                          },
                        ],
                        gasUSD: '0.009530',
                      },
                    },
                  ],
                },
              ],
            },
          ],
          gasCostUSD: '0.051297',
          gasCost: '538293',
          side: 'SELL',
          version: '6',
          contractAddress: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
          tokenTransferProxy: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
          contractMethod: 'swapExactAmountIn',
          partnerFee: 0,
          srcUSD: '9.0027410379',
          destUSD: '8.8473887559',
          partner: 'paraswap.io',
          maxImpactReached: false,
          hmac: '120cefa7049ca4c8ee821ca5d030bfb53aa63830',
        },
        userAddress: '0x5AC840Fb4738C36467aC673E87aaFa26C9397dcd',
      };

      await runE2ETest(
        route.priceRoute as OptimalRate,
        route.userAddress,
        contractAddresses,
        route.blockNumber,
      );
    });

    it('new: AAVE => PSP', async () => {
      const route = {
        blockNumber: 53996931,
        priceRoute: {
          blockNumber: 53996915,
          network: 137,
          srcToken: '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
          srcDecimals: 18,
          srcAmount: '41377866617173677',
          destToken: '0x42d61d766b85431666b39b89c43011f24451bff6',
          destDecimals: 18,
          destAmount: '80757322983809613682',
          bestRoute: [
            {
              percent: 100,
              swaps: [
                {
                  srcToken: '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
                  srcDecimals: 18,
                  destToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                  destDecimals: 18,
                  swapExchanges: [
                    {
                      exchange: 'UniswapV3',
                      srcAmount: '41377866617173677',
                      destAmount: '4002215076179070077',
                      percent: 100,
                      poolAddresses: [
                        '0xb3866eb993e1aef93f219c3da0a71c3f11becbf2',
                      ],
                      data: {
                        path: [
                          {
                            tokenIn:
                              '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
                            tokenOut:
                              '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                            fee: '500',
                            currentFee: '500',
                          },
                        ],
                        gasUSD: '0.004287',
                      },
                    },
                  ],
                },
                {
                  srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                  srcDecimals: 18,
                  destToken: '0x42d61d766b85431666b39b89c43011f24451bff6',
                  destDecimals: 18,
                  swapExchanges: [
                    {
                      exchange: 'QuickSwap',
                      srcAmount: '4002215076179070077',
                      destAmount: '80757322983809613682',
                      percent: 100,
                      poolAddresses: [
                        '0x7AfC060acCA7ec6985d982dD85cC62B111CAc7a7',
                      ],
                      data: {
                        router: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
                        path: [
                          '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                          '0x42d61d766b85431666b39b89c43011f24451bff6',
                        ],
                        factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
                        initCode:
                          '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
                        feeFactor: 10000,
                        pools: [
                          {
                            address:
                              '0x7AfC060acCA7ec6985d982dD85cC62B111CAc7a7',
                            fee: 30,
                            direction: true,
                          },
                        ],
                        gasUSD: '0.003540',
                      },
                    },
                  ],
                },
              ],
            },
          ],
          gasCostUSD: '0.010177',
          gasCost: '258740',
          side: 'SELL',
          version: '6',
          contractAddress: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
          tokenTransferProxy: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
          contractMethod: 'swapExactAmountIn',
          partnerFee: 0,
          srcUSD: '4.2524033522',
          destUSD: '4.2127057535',
          partner: 'paraswap.io',
          maxImpactReached: false,
          hmac: 'a26968ec4fcd57a2a291bd62a19f79f4d730cfbe',
        },
        userAddress: '0xf32F15f401F2822E7c841EcDCB2D6218b6b51522',
      };

      await runE2ETest(
        route.priceRoute as OptimalRate,
        route.userAddress,
        contractAddresses,
        route.blockNumber,
      );
    });

    it.only('new: YELLOW => MATIC', async () => {
      const route = {
        blockNumber: 54019870,
        priceRoute: {
          blockNumber: 54019855,
          network: 137,
          srcToken: '0x18e73a5333984549484348a94f4d219f4fab7b81',
          srcDecimals: 8,
          srcAmount: '6000000000',
          destToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          destDecimals: 18,
          destAmount: '412401870835858902',
          bestRoute: [
            {
              percent: 100,
              swaps: [
                {
                  srcToken: '0x18e73a5333984549484348a94f4d219f4fab7b81',
                  srcDecimals: 8,
                  destToken: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
                  destDecimals: 6,
                  swapExchanges: [
                    {
                      exchange: 'UniswapV3',
                      srcAmount: '6000000000',
                      destAmount: '435255',
                      percent: 100,
                      poolAddresses: [
                        '0x046bbdd927fc635dd6de7cf4efdad3e767274074',
                      ],
                      data: {
                        path: [
                          {
                            tokenIn:
                              '0x18e73a5333984549484348a94f4d219f4fab7b81',
                            tokenOut:
                              '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
                            fee: '3000',
                            currentFee: '3000',
                          },
                        ],
                        gasUSD: '0.009323',
                      },
                    },
                  ],
                },
                {
                  srcToken: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
                  srcDecimals: 6,
                  destToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                  destDecimals: 18,
                  swapExchanges: [
                    {
                      exchange: 'SushiSwap',
                      srcAmount: '435255',
                      destAmount: '412401870835858902',
                      percent: 100,
                      poolAddresses: [
                        '0x55FF76BFFC3Cdd9D5FdbBC2ece4528ECcE45047e',
                      ],
                      data: {
                        router: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
                        path: [
                          '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
                          '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                        ],
                        factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
                        initCode:
                          '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
                        feeFactor: 10000,
                        pools: [
                          {
                            address:
                              '0x55FF76BFFC3Cdd9D5FdbBC2ece4528ECcE45047e',
                            fee: 30,
                            direction: false,
                          },
                        ],
                        gasUSD: '0.007698',
                      },
                    },
                  ],
                },
              ],
            },
          ],
          gasCostUSD: '0.022256',
          gasCost: '260190',
          side: 'SELL',
          version: '6',
          contractAddress: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
          tokenTransferProxy: '0xFc736f39579B25BdcCcAac9BcA34D3528B88f1bE',
          contractMethod: 'swapExactAmountIn',
          partnerFee: 0,
          srcUSD: '0.4314036000',
          destUSD: '0.4354963756',
          partner: 'paraswap.io',
          maxImpactReached: false,
          hmac: 'ec272b0d210992f6268938b2371cd78d9e47e77d',
        },
        userAddress: '0x3b4512e84017EC2dbc24e97006b47318807E1d3F',
      };

      await runE2ETest(
        route.priceRoute as OptimalRate,
        route.userAddress,
        contractAddresses,
        route.blockNumber,
      );
    });
  });
});
