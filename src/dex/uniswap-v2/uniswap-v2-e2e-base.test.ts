import { constructE2ETests } from '../../../tests/utils-e2e';
import { Network } from '../../constants';

constructE2ETests('UniswapV2 E2E Base', Network.BASE, {
  Alien: [
    [
      { name: 'WETH', sellAmount: '700000000000', buyAmount: '1000' },
      { name: 'USDbC', sellAmount: '100000', buyAmount: '4000' },
    ],
  ],
  RocketSwap: [
    [
      { name: 'WETH', sellAmount: '700000000000', buyAmount: '1000' },
      { name: 'USDbC', sellAmount: '100000', buyAmount: '4000' },
    ],
  ],
  SoSwap: [
    [
      { name: 'WETH', sellAmount: '700000000000', buyAmount: '1000' },
      { name: 'USDbC', sellAmount: '100000', buyAmount: '4000' },
    ],
  ],

  SwapBased: [
    [
      { name: 'WETH', sellAmount: '700000000000', buyAmount: '1000' },
      { name: 'USDbC', sellAmount: '100000', buyAmount: '4000' },
    ],
  ],
  SharkSwap: [
    [
      { name: 'WETH', sellAmount: '700000000000', buyAmount: '1000' },
      { name: 'USDbC', sellAmount: '100000', buyAmount: '4000' },
    ],
  ],
  DackieSwap: [
    [
      { name: 'WETH', sellAmount: '700000000000', buyAmount: '1000' },
      { name: 'USDbC', sellAmount: '100000', buyAmount: '4000' },
    ],
  ],
});
