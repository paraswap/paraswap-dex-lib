import { PayloadEncoder } from '../src/router/payload-encoder';

const enumerateDummySwapExchnage = (exchanges: string[]) => exchanges.map(e => ({
  exchange: e,
  srcAmount: '0',
  destAmount: '0',
  percent: 0,
  data: null,
})) 

describe('PayloadEncoder', function () {
  it('getOptimalExchangeAdapterMap', function () {
    const adapters = {
      'uniswapv2': [{adapter: 'adapter0', index: 0}, {adapter: 'adapter3', index: 0}],
      'sushiswap': [{adapter: 'adapter0', index: 1}, {adapter: 'adapter2', index: 0}],
      'linkswap': [{adapter: 'adapter1', index: 0}, {adapter: 'adapter2', index: 1}],
      'bitswap': [{adapter: 'adapter1', index: 1}, {adapter: 'adapter3', index: 1}],
    }
    const exchanges = enumerateDummySwapExchnage(['uniswapv2', 'sushiswap', 'linkswap', 'bitswap']);
    const payloadEncoder = new PayloadEncoder({}, adapters);
    const expectedOptimalExchangeAdapterMap = {
      'uniswapv2': ['adapter0', 0],
      'sushiswap': ['adapter0', 1],
      'linkswap': ['adapter1', 0],
      'bitswap': ['adapter1', 1],
    }
    const optimalExchangeAdapter = payloadEncoder.getOptimalExchangeAdapterMap(exchanges);
    expect(optimalExchangeAdapter).toEqual(expectedOptimalExchangeAdapterMap);
  });
});