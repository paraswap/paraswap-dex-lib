import dotenv from 'dotenv';
dotenv.config();
import _ from 'lodash';
import { NerveEventPool } from './nerve-pool';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState } from './types';
import { typeCastPoolState } from './utils';
import { Nerve } from './nerve';
import { threePoolName } from './config';

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
  const poolName = threePoolName;
  const network = Network.BSC;
  const testPoolAddress = '0x1B3771a66ee31180906972580adE9b81AFc5fCDc'; // 3Pool
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let nervePool: NerveEventPool;

  beforeEach(async () => {
    nervePool = new NerveEventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      poolName,
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

describe('Saddle Event Pool Mainnet', async () => {
  const dexKey = 'Saddle';
  const network = Network.MAINNET;
  const poolName = 'D4';
  const testPoolAddress = '0xc69ddcd4dfef25d8a793241834d4cc4b3668ead6'; // D4
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let nervePool: NerveEventPool;

  beforeEach(async () => {
    nervePool = new NerveEventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      poolName,
    );
  });

  // TokenSwap -> 0xc6c1e0630dbe9130cc068028486c0d118ddcea348550819defd5cb8c257f8a38
  describe('TokenSwap', () => {
    it(`State after 14565294`, async () => {
      const blockNumber = 14565294;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14564927`, async () => {
      const blockNumber = 14564927;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14564179`, async () => {
      const blockNumber = 14564179;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14563209`, async () => {
      const blockNumber = 14563209;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14563208`, async () => {
      const blockNumber = 14563208;
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
    it(`State after 14556387`, async () => {
      const blockNumber = 14556387;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14544895`, async () => {
      const blockNumber = 14544895;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14527267`, async () => {
      const blockNumber = 14527267;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14524769`, async () => {
      const blockNumber = 14524769;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14517869`, async () => {
      const blockNumber = 14517869;
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
    it(`State after 14424007`, async () => {
      const blockNumber = 14424007;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14241298`, async () => {
      const blockNumber = 14241298;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 14055041`, async () => {
      const blockNumber = 14055041;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 13691211`, async () => {
      const blockNumber = 13691211;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 13678650`, async () => {
      const blockNumber = 13678650;
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
    it(`State after 12776217`, async () => {
      const blockNumber = 12776217;
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
  describe('NewAdminFee', () => {
    it(`State after 14083636`, async () => {
      const blockNumber = 14083636;
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

  // RampA -> 0xa2b71ec6df949300b59aab36b55e189697b750119dd349fcfa8c0f779e83c254
  describe('RampA', () => {
    it(`State after 14083648`, async () => {
      const blockNumber = 14083648;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 13227031`, async () => {
      const blockNumber = 13227031;
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

  // RemoveLiquidityOne -> 0x43fb02998f4e03da2e0e6fff53fdbf0c40a9f45f145dc377fc30615d7d7a8a64
  // We do not support RemoveLiquidityOne as it requires onchain call of exact values

  // NewWithdrawFee -> 0xd5fe46099fa396290a7f57e36c3c3c8774e2562c18ed5d1dcc0fa75071e03f1d
  // No events for NewWithdrawFee

  // StopRampA -> 0x46e22fb3709ad289f62ce63d469248536dbc78d82b84a3d7e74ad606dc201938
  // No events for StopRampA

  // NewSwapFee -> 0xd88ea5155021c6f8dafa1a741e173f595cdf77ce7c17d43342131d7f06afdfe5
  // No events for NewSwapFee

  // NewDepositFee -> 0x5237b692334926d9ab50f9d1ac513fe7e153f0cd81dd7c55a09d281d2985d808
  // No events for NewDepositFee
});

describe('IronV2 Event Pool Polygon', async () => {
  const dexKey = 'IronV2';
  const poolName = 'IS3USD_POLYGON';
  const network = Network.POLYGON;
  const testPoolAddress = '0x837503e8A8753ae17fB8C8151B8e6f586defCb57'; // IS3USD
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let nervePool: NerveEventPool;

  beforeEach(async () => {
    nervePool = new NerveEventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      poolName,
    );
  });

  // TokenExchange -> 0xb2e76ae99761dc136e598d4a629bb347eccb9532a5f8bbd72e18467c3c34cc98
  describe('TokenExchange', () => {
    it(`State after 27019055`, async () => {
      const blockNumber = 27019055;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 27019043`, async () => {
      const blockNumber = 27019043;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 27019042`, async () => {
      const blockNumber = 27019042;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 27018991`, async () => {
      const blockNumber = 27018991;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 27018933`, async () => {
      const blockNumber = 27018933;
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
    it(`State after 27019013`, async () => {
      const blockNumber = 27019013;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 27017516`, async () => {
      const blockNumber = 27017516;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 27017515`, async () => {
      const blockNumber = 27017515;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 27017333`, async () => {
      const blockNumber = 27017333;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 27015656`, async () => {
      const blockNumber = 27015656;
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

  // RemoveLiquidity -> 0x347ad828e58cbe534d8f6b67985d791360756b18f0d95fd9f197a66cc46480ea
  describe('RemoveLiquidity', () => {
    it(`State after 27009010`, async () => {
      const blockNumber = 27009010;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 26993341`, async () => {
      const blockNumber = 26993341;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 26993296`, async () => {
      const blockNumber = 26993296;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 26973410`, async () => {
      const blockNumber = 26973410;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 26749868`, async () => {
      const blockNumber = 26749868;
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

  // NewFee -> 0xcfca96e0fef3432146913b2a5a2268a55d3f475fe057e7ffde1082b77693f4f3
  describe('NewFee', () => {
    it(`State after 17064317`, async () => {
      const blockNumber = 17064317;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16813530`, async () => {
      const blockNumber = 16813530;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16632075`, async () => {
      const blockNumber = 16632075;
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

  // RampA -> 0xa2b71ec6df949300b59aab36b55e189697b750119dd349fcfa8c0f779e83c254
  describe('RampA', () => {
    it(`State after 17202291`, async () => {
      const blockNumber = 17202291;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17132310`, async () => {
      const blockNumber = 17132310;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17062453`, async () => {
      const blockNumber = 17062453;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16809165`, async () => {
      const blockNumber = 16809165;
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

  // StopRampA -> 0x46e22fb3709ad289f62ce63d469248536dbc78d82b84a3d7e74ad606dc201938
  describe('StopRampA', () => {
    it(`State after 17095506`, async () => {
      const blockNumber = 17095506;
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

  // RemoveLiquidityOne -> 0x5ad056f2e28a8cec232015406b843668c1e36cda598127ec3b8c59b8c72773a0
  // We do not support RemoveLiquidityOne as it requires onchain call of exact values

  // RemoveLiquidityImbalance -> 0x3631c28b1f9dd213e0319fb167b554d76b6c283a41143eb400a0d1adb1af1755
  // No events for RemoveLiquidityImbalance
});

describe('Synapse Event Pool Arbitrum', async () => {
  const dexKey = 'Synapse';
  const network = Network.ARBITRUM;
  const poolName = 'nUSDV3';
  const testPoolAddress = '0x9Dd329F5411466d9e0C488fF72519CA9fEf0cb40'; // nUSDV3
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let nervePool: NerveEventPool;

  beforeEach(async () => {
    nervePool = new NerveEventPool(
      dexKey,
      network,
      dexHelper,
      logger,
      poolName,
    );
  });

  // TokenSwap -> 0xc6c1e0630dbe9130cc068028486c0d118ddcea348550819defd5cb8c257f8a38
  describe('TokenSwap', () => {
    it(`State after 17256191`, async () => {
      const blockNumber = 17256191;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17256467`, async () => {
      const blockNumber = 17256467;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17256191`, async () => {
      const blockNumber = 17256191;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17256173 `, async () => {
      const blockNumber = 17256173;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17256144`, async () => {
      const blockNumber = 17256144;
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
    it(`State after 17220979`, async () => {
      const blockNumber = 17220979;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17186516`, async () => {
      const blockNumber = 17186516;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17186114`, async () => {
      const blockNumber = 17186114;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17180822`, async () => {
      const blockNumber = 17180822;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17154508`, async () => {
      const blockNumber = 17154508;
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
    it(`State after 17232908`, async () => {
      const blockNumber = 17232908;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 17154430`, async () => {
      const blockNumber = 17154430;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 16780865`, async () => {
      const blockNumber = 16780865;
      await testEventSubscriber(
        nervePool,
        nervePool.addressesSubscribed,
        (_blockNumber: number) => fetchPoolState(nervePool, _blockNumber),
        blockNumber,
        Nerve.getIdentifier(dexKey, testPoolAddress),
        dexHelper.provider,
      );
    });
    it(`State after 13691211`, async () => {
      const blockNumber = 13691211;
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

  // NewSwapFee -> 0xd88ea5155021c6f8dafa1a741e173f595cdf77ce7c17d43342131d7f06afdfe5
  describe('NewSwapFee', () => {
    it(`State after 11349722`, async () => {
      const blockNumber = 11349722;
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
});
