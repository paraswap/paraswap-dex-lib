import dotenv from 'dotenv';
dotenv.config();

import { OptimalRate } from '@paraswap/core';
import { generateConfig } from '../src/config';
import { ContractsAugustusV6, runE2ETest } from './v6/utils-e2e-v6';
import { assert } from 'ts-essentials';

// set timeout to 2 min
jest.setTimeout(120000);

describe('Debug Price Route', function () {
  it('test', async () => {
    const route = require('./debug-price-route.json');

    assert(
      'priceRoute' in route,
      'priceRoute is missing, please dump full TxOpts',
    );
    assert(
      'minMaxAmount' in route,
      'minMaxAmount is missing, please dump full TxOpts',
    );

    const {
      priceRoute: { network },
    } = route;

    const config = generateConfig(network);
    const { augustusV6Address, executorsAddresses: _executorsAddresses } =
      config;

    assert(augustusV6Address, 'augustus should be defined');
    assert(_executorsAddresses, 'executors should be defined');
    assert('Executor01' in _executorsAddresses, 'executor01 should be defined');
    assert('Executor02' in _executorsAddresses, 'executor02 should be defined');
    assert('Executor03' in _executorsAddresses, 'executor03 should be defined');

    const executorsAddresses = _executorsAddresses as Pick<
      ContractsAugustusV6,
      'Executor01' | 'Executor02' | 'Executor03'
    >;

    const contractAddresses: ContractsAugustusV6 = {
      AugustusV6: augustusV6Address,
      ...executorsAddresses,
    };

    await runE2ETest(
      route.priceRoute as OptimalRate,
      route.userAddress,
      contractAddresses,
    );
  });
});
