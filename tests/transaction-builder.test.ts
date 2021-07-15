import { TransactionBuilder } from '../src/transaction-builder';
import { SwapSide, ContractMethod } from '../src/constants';

const AugustusAddress = '0x1bD435F3C054b6e901B7b108a0ab7617C808677b';

describe('Transaction Builder', function () {
  it('multiSwap', function () {
    const txBuilder = new TransactionBuilder(AugustusAddress);
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
      contractMethod: ContractMethod.multiSwap,
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
    const params = txBuilder.build(
      priceRoute,
      '2636005530238615700000000',
      '0x05182E579FDfCf69E4390c3411D8FeA1fb6467cf',
      '0xba12222222228d8ba445958a75a0704d566bf2c8',
      '30',
      '10000000000',
      '0x',
      '0',
      undefined,
      true,
    );
    // console.log(JSON.stringify(params, null, 2));
    expect(params).toEqual(expectedParams);
  });
});
