import dotenv from 'dotenv';
dotenv.config();
import { BalancerV2 } from './balancer-v2';
import { DummyDexHelper } from '../../dex-helper';
import { Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide, MAX_UINT, MAX_INT } from '../../constants';
import { OptimizedBalancerV2Data, SwapTypes } from './types';

const network = Network.MAINNET;
const tokens = Tokens[network];
let balancer: BalancerV2;
let dexHelper: DummyDexHelper;
const side: SwapSide = SwapSide.SELL;
const srcAmount = '2000000000';
const srcToken = tokens['USDC'];
const destAmount = '4';
const destToken = tokens['DAI'];

describe('getBalancerParam, should create correct swap parameters', () => {
  beforeAll(async () => {
    dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    balancer = new BalancerV2(network, 'BalancerV2', dexHelper);
    await balancer.setupEventPools(blocknumber);
  });
  describe('single swap', () => {
    it('No Virtual', () => {
      const poolId =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
      const data: OptimizedBalancerV2Data = {
        swaps: [
          {
            poolId,
            amount: srcAmount,
          },
        ],
      };
      // [swapType, swaps[], funds, limits[], timeout]
      const param = balancer.getBalancerParam(
        srcToken.address,
        destToken.address,
        srcAmount,
        destAmount,
        data,
        side,
      );
      expect(param.length).toEqual(6);
      expect(param[0]).toEqual(SwapTypes.SwapExactIn);
      expect(param[1]).toEqual([
        {
          poolId,
          assetInIndex: 0,
          assetOutIndex: 1,
          amount: srcAmount,
          userData: '0x',
        },
      ]);
      expect(param[2]).toEqual([srcToken.address, destToken.address]);
      expect(param[3]).toEqual({
        sender: dexHelper.augustusAddress,
        recipient: dexHelper.augustusAddress,
        fromInternalBalance: false,
        toInternalBalance: false,
      });
      expect(param[4]).toEqual(Array(param[2].length).fill(MAX_INT));
      expect(param[5]).toEqual(MAX_UINT);
    });

    it('With VirtualBoosted', () => {
      const poolId =
        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fevirtualboosted';
      const data: OptimizedBalancerV2Data = {
        swaps: [
          {
            poolId,
            amount: srcAmount,
          },
        ],
      };
      const param = balancer.getBalancerParam(
        srcToken.address,
        destToken.address,
        srcAmount,
        destAmount,
        data,
        side,
      );
      expect(param.length).toEqual(6);
      expect(param[0]).toEqual(SwapTypes.SwapExactIn);
      expect(param[1]).toEqual([
        {
          poolId:
            '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
          assetInIndex: 0,
          assetOutIndex: 2,
          amount: '2000000000',
          userData: '0x',
        },
        {
          poolId:
            '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
          assetInIndex: 2,
          assetOutIndex: 3,
          amount: '0',
          userData: '0x',
        },
        {
          poolId:
            '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
          assetInIndex: 3,
          assetOutIndex: 1,
          amount: '0',
          userData: '0x',
        },
      ]);
      expect(param[2]).toEqual([
        srcToken.address,
        destToken.address,
        '0x9210f1204b5a24742eba12f710636d76240df3d0',
        '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
      ]);
      expect(param[3]).toEqual({
        sender: dexHelper.augustusAddress,
        recipient: dexHelper.augustusAddress,
        fromInternalBalance: false,
        toInternalBalance: false,
      });
      expect(param[4]).toEqual(Array(param[2].length).fill(MAX_INT));
      expect(param[5]).toEqual(MAX_UINT);
    });
  });

  describe('2 Swaps', () => {
    const srcAmount1 = '2000000000';
    const srcAmount2 = '3000000000';
    const srcToken = tokens['USDC'];
    const destAmount = '4';
    const destToken = tokens['DAI'];
    const side: SwapSide = SwapSide.SELL;

    it('No Virtual', () => {
      const poolId1 =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
      const poolId2 =
        '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063';

      const data: OptimizedBalancerV2Data = {
        swaps: [
          {
            poolId: poolId1,
            amount: srcAmount1,
          },
          {
            poolId: poolId2,
            amount: srcAmount2,
          },
        ],
      };
      const param = balancer.getBalancerParam(
        srcToken.address,
        destToken.address,
        (BigInt(srcAmount1) + BigInt(srcAmount2)).toString(),
        destAmount,
        data,
        side,
      );
      expect(param.length).toEqual(6);
      expect(param[0]).toEqual(SwapTypes.SwapExactIn);
      expect(param[1]).toEqual([
        {
          poolId: poolId1,
          assetInIndex: 0,
          assetOutIndex: 1,
          amount: srcAmount1,
          userData: '0x',
        },
        {
          poolId: poolId2,
          assetInIndex: 0,
          assetOutIndex: 1,
          amount: srcAmount2,
          userData: '0x',
        },
      ]); // swaps
      expect(param[2]).toEqual([srcToken.address, destToken.address]);
      expect(param[3]).toEqual({
        sender: dexHelper.augustusAddress,
        recipient: dexHelper.augustusAddress,
        fromInternalBalance: false,
        toInternalBalance: false,
      }); // funds
      expect(param[4]).toEqual(Array(param[2].length).fill(MAX_INT)); // limits
      expect(param[5]).toEqual(MAX_UINT);
    });
    it('With 1 VirtualBoosted', () => {
      const poolId1 =
        '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
      const poolId2 =
        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fevirtualboosted';
      const data: OptimizedBalancerV2Data = {
        swaps: [
          {
            poolId: poolId1,
            amount: srcAmount1,
          },
          {
            poolId: poolId2,
            amount: srcAmount2,
          },
        ],
      };
      const param = balancer.getBalancerParam(
        srcToken.address,
        destToken.address,
        (BigInt(srcAmount1) + BigInt(srcAmount2)).toString(),
        destAmount,
        data,
        side,
      );
      expect(param.length).toEqual(6);
      expect(param[0]).toEqual(SwapTypes.SwapExactIn);
      expect(param[1]).toEqual([
        {
          poolId: poolId1,
          assetInIndex: 0,
          assetOutIndex: 1,
          amount: srcAmount1,
          userData: '0x',
        },
        {
          poolId:
            '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
          assetInIndex: 0,
          assetOutIndex: 2,
          amount: srcAmount2,
          userData: '0x',
        },
        {
          poolId:
            '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
          assetInIndex: 2,
          assetOutIndex: 3,
          amount: '0',
          userData: '0x',
        },
        {
          poolId:
            '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
          assetInIndex: 3,
          assetOutIndex: 1,
          amount: '0',
          userData: '0x',
        },
      ]);
      expect(param[2]).toEqual([
        srcToken.address,
        destToken.address,
        '0x9210f1204b5a24742eba12f710636d76240df3d0',
        '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
      ]);
      expect(param[3]).toEqual({
        sender: dexHelper.augustusAddress,
        recipient: dexHelper.augustusAddress,
        fromInternalBalance: false,
        toInternalBalance: false,
      });
      expect(param[4]).toEqual(Array(param[2].length).fill(MAX_INT));
      expect(param[5]).toEqual(MAX_UINT);
    });
    it('With 2 VirtualBoosted', () => {
      const poolId1 =
        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fevirtualboosted';
      const poolId2 =
        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fevirtualboosted';
      const data: OptimizedBalancerV2Data = {
        swaps: [
          {
            poolId: poolId1,
            amount: srcAmount1,
          },
          {
            poolId: poolId2,
            amount: srcAmount2,
          },
        ],
      };
      const param = balancer.getBalancerParam(
        srcToken.address,
        destToken.address,
        (BigInt(srcAmount1) + BigInt(srcAmount2)).toString(),
        destAmount,
        data,
        side,
      );
      expect(param.length).toEqual(6);
      expect(param[0]).toEqual(SwapTypes.SwapExactIn);
      expect(param[1]).toEqual([
        {
          poolId:
            '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
          assetInIndex: 0,
          assetOutIndex: 2,
          amount: srcAmount1,
          userData: '0x',
        },
        {
          poolId:
            '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
          assetInIndex: 2,
          assetOutIndex: 3,
          amount: '0',
          userData: '0x',
        },
        {
          poolId:
            '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
          assetInIndex: 3,
          assetOutIndex: 1,
          amount: '0',
          userData: '0x',
        },
        {
          poolId:
            '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
          assetInIndex: 0,
          assetOutIndex: 2,
          amount: srcAmount2,
          userData: '0x',
        },
        {
          poolId:
            '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
          assetInIndex: 2,
          assetOutIndex: 3,
          amount: '0',
          userData: '0x',
        },
        {
          poolId:
            '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
          assetInIndex: 3,
          assetOutIndex: 1,
          amount: '0',
          userData: '0x',
        },
      ]);
      expect(param[2]).toEqual([
        srcToken.address,
        destToken.address,
        '0x9210f1204b5a24742eba12f710636d76240df3d0',
        '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
      ]);
      expect(param[3]).toEqual({
        sender: dexHelper.augustusAddress,
        recipient: dexHelper.augustusAddress,
        fromInternalBalance: false,
        toInternalBalance: false,
      });
      expect(param[4]).toEqual(Array(param[2].length).fill(MAX_INT));
      expect(param[5]).toEqual(MAX_UINT);
    });
  });
});
