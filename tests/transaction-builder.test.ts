import { TransactionBuilder } from '../src/transaction-builder';
import { SwapSide } from '../src/constants';

const AugustusAddress = '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57';

describe('Transaction Builder', function () {
  // it('simpleSwap', async function () {
  //   const txBuilder = new TransactionBuilder(
  //     AugustusAddress,
  //     137,
  //     <any>undefined,
  //     {},
  //   );
  //   const params = await txBuilder.build({
  //     priceRoute: {
  //       blockNumber: 18419316,
  //       network: 137,
  //       srcToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  //       srcDecimals: 18,
  //       srcAmount: '1000000000000000000000',
  //       destToken: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  //       destDecimals: 6,
  //       destAmount: '1412291985',
  //       bestRoute: [
  //         {
  //           percent: 100,
  //           swaps: [
  //             {
  //               srcToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  //               srcDecimals: 18,
  //               destToken: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  //               destDecimals: 6,
  //               swapExchanges: [
  //                 {
  //                   exchange: 'QuickSwap',
  //                   srcAmount: '440000000000000000000',
  //                   destAmount: '621102399',
  //                   percent: 44,
  //                   poolAddresses: [
  //                     '0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827',
  //                   ],
  //                   data: {
  //                     router: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
  //                     path: [
  //                       '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  //                       '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  //                     ],
  //                     factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
  //                     initCode:
  //                       '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
  //                     feeFactor: 10000,
  //                     pools: [
  //                       {
  //                         address: '0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827',
  //                         fee: 30,
  //                         direction: true,
  //                       },
  //                     ],
  //                     gasUSD: '0.000639',
  //                   },
  //                 },
  //                 {
  //                   exchange: 'QuickSwap',
  //                   srcAmount: '560000000000000000000',
  //                   destAmount: '791189586',
  //                   percent: 56,
  //                   poolAddresses: [
  //                     '0x9b5c71936670e9f1F36e63F03384De7e06E60d2a',
  //                     '0xa5cABfC725DFa129f618D527E93702d10412f039',
  //                   ],
  //                   data: {
  //                     router: '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
  //                     path: [
  //                       '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  //                       '0xdf7837de1f2fa4631d716cf2502f8b230f1dcc32',
  //                       '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  //                     ],
  //                     factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
  //                     initCode:
  //                       '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
  //                     feeFactor: 10000,
  //                     pools: [
  //                       {
  //                         address: '0x9b5c71936670e9f1F36e63F03384De7e06E60d2a',
  //                         fee: 30,
  //                         direction: true,
  //                       },
  //                       {
  //                         address: '0xa5cABfC725DFa129f618D527E93702d10412f039',
  //                         fee: 30,
  //                         direction: false,
  //                       },
  //                     ],
  //                     gasUSD: '0.001278',
  //                   },
  //                 },
  //               ],
  //             },
  //           ],
  //         },
  //       ],
  //       gasCostUSD: '0.002465',
  //       gasCost: '347177',
  //       side: SwapSide.SELL,
  //       tokenTransferProxy: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
  //       contractAddress: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
  //       contractMethod: 'simpleSwap',
  //       partnerFee: 0,
  //       srcUSD: '1420.0000000000',
  //       destUSD: '1409.9800630205',
  //       partner: 'paraswap.io',
  //       maxImpactReached: false,
  //       hmac: '482b516147ae997c061ca268c8e7604e4cb5b046',
  //     },
  //     minMaxAmount: '1313431546',
  //     userAddress: '0x84D34f4f83a87596Cd3FB6887cFf8F17Bf5A7B83',
  //     partnerAddress: '0x0000000000000000000000000000000074657374',
  //     partnerFeePercent: '0',
  //     gasPrice: '5000000000',
  //     deadline: '1629992302',
  //     uuid: '73e56730-067f-11ec-925c-b98659a7d2b5',
  //     beneficiary: '0x0000000000000000000000000000000000000000',
  //     onlyParams: true,
  //   });
  //   const expectedParams = [
  //     {
  //       callees: [
  //         '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
  //         '0xf3938337F7294fEf84e9B2c6D548A93F956Cc281',
  //       ],
  //       values: ['440000000000000000000', '560000000000000000000'],
  //       exchangeData:
  //         '0x91a32b69000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000000000000000000000000017da3a04c7b3e00000000000000000000000000000000000000000000000000000000000002505453f0000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf127000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000004de46e7a5fafcec6bb1e78bae2a1f0b612012bf1482791a32b69000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000001e5b8fa8fe2ac00000000000000000000000000000000000000000000000000000000000002f2898520000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf127000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000002000000000000000000004de49b5c71936670e9f1f36e63f03384de7e06e60d2a000000000000000000004de5a5cabfc725dfa129f618d527e93702d10412f039',
  //       startIndexes: [0, 228, 488],
  //       fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  //       toToken: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  //       fromAmount: '1000000000000000000000',
  //       toAmount: '1313431546',
  //       expectedAmount: '1412291985',
  //       beneficiary: '0x0000000000000000000000000000000000000000',
  //       partner: '0x0000000000000000000000000000000074657374',
  //       feePercent: '0',
  //       permit: '0x',
  //       deadline: '1629992302',
  //       uuid: '0x73e56730067f11ec925cb98659a7d2b5',
  //     },
  //   ];
  //   expect(params).toEqual(expectedParams);
  // });
  /*it('multiSwap', function () {
    const txBuilder = new TransactionBuilder(AugustusAddress, 1, '', {
      uniswapv2: [
        { adapter: '0x0000000000000000000000000000000000000000', index: 1 },
      ],
    });
    const priceRoute = {
      blockNumber: 0,
      network: 1,
      src: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      srcDecimals: 18,
      srcUSD: '0',
      srcAmount: '1000000000000000000000',
      dest: '0xc944e90c64b2c07662a292be6244bdf05cda44a7',
      destDecimals: 18,
      destAmount: '2736005530238615700000000',
      destUSD: '0',
      bestRoute: [
        {
          percent: 100,
          swaps: [
            {
              src: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
              srcDecimals: 18,
              dest: '0xc944e90c64b2c07662a292be6244bdf05cda44a7',
              destDecimals: 18,
              swapExchanges: [
                {
                  exchange: 'UniswapV2',
                  srcAmount: '1000000000000000000000',
                  destAmount: '2736005530238615700000000',
                  percent: 100,
                  data: {
                    router: '0x86d3579b043585A97532514016dCF0C2d6C4b6a1',
                    path: [
                      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                      '0xc944e90c64b2c07662a292be6244bdf05cda44a7',
                    ],
                    factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
                    initCode:
                      '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
                  },
                },
              ],
            },
          ],
        },
      ],
      gasCostUSD: '0',
      gasCost: '0',
      side: SwapSide.SELL,
      contractMethod: 'swapOnUniswap',
      tokenTransferProxy: '0xb70Bc06D2c9Bf03b3373799606dc7d39346c06B3',
      contractAddress: '0xb70Bc06D2c9Bf03b3373799606dc7d39346c06B3',
      partner: 'dummy',
      hmac: 'random-hmac',
    };
    const expectedParams = [
      {
        fromToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        fromAmount: '1000000000000000000000',
        toAmount: '2636005530238615700000000',
        expectedAmount: '2736005530238615700000000',
        beneficiary: '0x05182E579FDfCf69E4390c3411D8FeA1fb6467cf',
        path: [],
        partner: '0xba12222222228d8ba445958a75a0704d566bf2c8',
        feePercent: '30',
        permit: '0x',
        deadline: '0',
      },
    ];
    const params = txBuilder.build({
      priceRoute,
      minMaxAmount: '2636005530238615700000000',
      userAddress: '0x05182E579FDfCf69E4390c3411D8FeA1fb6467cf',
      partner: '0xba12222222228d8ba445958a75a0704d566bf2c8',
      feePercent: '30',
      gasPrice: '10000000000',
      deadline: '0',
      onlyParams: true,
    });
    // console.log(JSON.stringify(params, null, 2));
    expect(params).toEqual(expectedParams);
  });*/
});
