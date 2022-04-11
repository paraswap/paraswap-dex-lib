import dotenv from 'dotenv';
dotenv.config();
import _ from 'lodash';
import { NerveEventPool } from './nerve-pool';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { EventPoolOrMetapool, PoolState } from './types';
import { typeCastPoolState } from './utils';
import { Nerve } from './nerve';
import { NerveConfig, threePoolName } from './config';

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  nervePool: NerveEventPool,
  blockNumber: number,
): Promise<PoolState> {
  // It generates data from onchain data
  return typeCastPoolState(
    _.cloneDeep(await nervePool.generateState(blockNumber)),
  );
}

describe('Nerve Event Pool BSC', async () => {
  const dexKey = 'Nerve';
  const network = Network.BSC;
  const config = NerveConfig[dexKey][network];
  const testPoolAddress = '0x1B3771a66ee31180906972580adE9b81AFc5fCDc'; // 3Pool
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let nervePool: EventPoolOrMetapool;

  beforeEach(async () => {
    nervePool = new NerveEventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      config.poolConfigs[threePoolName].name,
    );
  });

  // TokenSwap -> 0xc6c1e0630dbe9130cc068028486c0d118ddcea348550819defd5cb8c257f8a38
  describe('TokenSwap', () => {
    it(`State after 16847285`, async () => {
      const blockNumber = 16847285;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16847392`, async () => {
      const blockNumber = 16847392;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16847496`, async () => {
      const blockNumber = 16847496;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16853100`, async () => {
      const blockNumber = 16853100;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16852788`, async () => {
      const blockNumber = 16852788;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
  });

  // AddLiquidity -> 0x189c623b666b1b45b83d7178f39b8c087cb09774317ca2f53c2d3c3726f222a2
  describe('AddLiquidity', () => {
    it(`State after 16714695`, async () => {
      const blockNumber = 16714695;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16714525`, async () => {
      const blockNumber = 16714525;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16630557`, async () => {
      const blockNumber = 16630557;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16222709`, async () => {
      const blockNumber = 16222709;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16116914`, async () => {
      const blockNumber = 16116914;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
  });

  // RemoveLiquidity -> 0x88d38ed598fdd809c2bf01ee49cd24b7fdabf379a83d29567952b60324d58cef
  describe('RemoveLiquidity', () => {
    it(`State after 16379090`, async () => {
      const blockNumber = 16379090;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16281403`, async () => {
      const blockNumber = 16281403;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16277100`, async () => {
      const blockNumber = 16277100;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16117267`, async () => {
      const blockNumber = 16117267;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 15929026`, async () => {
      const blockNumber = 15929026;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
  });

  // RemoveLiquidityImbalance -> 0x3631c28b1f9dd213e0319fb167b554d76b6c283a41143eb400a0d1adb1af1755
  describe('RemoveLiquidityImbalance', () => {
    it(`State after 15639364`, async () => {
      const blockNumber = 15639364;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 12543503`, async () => {
      const blockNumber = 12543503;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 11298608`, async () => {
      const blockNumber = 11298608;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 11298568`, async () => {
      const blockNumber = 11298568;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 10691460`, async () => {
      const blockNumber = 10691460;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
  });

  // NewAdminFee -> 0xab599d640ca80cde2b09b128a4154a8dfe608cb80f4c9399c8b954b01fd35f38
  // Tests are turned off because blocks are too old and I don't receive results from RPC
  // describe('NewAdminFee', () => {
  //   it(`State after 7287599`, async () => {
  //     const blockNumber = 7287599;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  // });

  // NewSwapFee -> 0xd88ea5155021c6f8dafa1a741e173f595cdf77ce7c17d43342131d7f06afdfe5
  // Tests are turned off because blocks are too old and I don't receive results from RPC
  // describe('NewSwapFee', () => {
  //   it(`State after 7386449`, async () => {
  //     const blockNumber = 7386449;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  //   it(`State after 6086293`, async () => {
  //     const blockNumber = 6086293;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  // });

  // NewDepositFee -> 0x5237b692334926d9ab50f9d1ac513fe7e153f0cd81dd7c55a09d281d2985d808
  // Tests are turned off because blocks are too old and I don't receive results from RPC
  // describe('NewDepositFee', () => {
  //   it(`State after 7035445`, async () => {
  //     const blockNumber = 7035445;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  //   it(`State after 6086217`, async () => {
  //     const blockNumber = 6086217;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  //   it(`State after 5654596`, async () => {
  //     const blockNumber = 5654596;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  //   it(`State after 5453031`, async () => {
  //     const blockNumber = 5453031;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  // });

  // RampA -> 0xa2b71ec6df949300b59aab36b55e189697b750119dd349fcfa8c0f779e83c254
  // Tests are turned off because blocks are too old and I don't receive results from RPC
  // describe('RampA', () => {
  //   it(`State after 7385654`, async () => {
  //     const blockNumber = 7385654;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  //   it(`State after 5914844`, async () => {
  //     const blockNumber = 5914844;
  //     await testEventSubscriber(
  //       nervePool,
  //       nervePool.addressesSubscribed,
  //       (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
  //       blockNumber,
  //       Nerve.getIdentifier(dexKey, testPoolAddress),
  //       dexHelper.provider,
  //     );
  //   });
  // });

  // RemoveLiquidityOne -> 0x43fb02998f4e03da2e0e6fff53fdbf0c40a9f45f145dc377fc30615d7d7a8a64
  // We do not support RemoveLiquidityOne as it requires onchain call of exact values

  // NewWithdrawFee -> 0xd5fe46099fa396290a7f57e36c3c3c8774e2562c18ed5d1dcc0fa75071e03f1d
  // No events for NewWithdrawFee

  // StopRampA -> 0x46e22fb3709ad289f62ce63d469248536dbc78d82b84a3d7e74ad606dc201938
  // No events for StopRampA
});
