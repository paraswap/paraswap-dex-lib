import { getAddress } from '@ethersproject/address';
import { Interface } from '@ethersproject/abi';
import { BZERO } from './balancer-v2-math';
import { LinearPool } from './LinearPool';
import { PhantomStablePool } from './PhantomStablePool';
import {
  PoolState,
  TokenState,
  SubgraphPoolBase,
  callData,
  BalancerSwap,
} from './types';
import { SwapSide, MAX_INT } from '../../constants';

import LinearPoolABI from '../../abi/balancer-v2/linearPoolAbi.json';
import MetaStablePoolABI from '../../abi/balancer-v2/meta-stable-pool.json';

export type MainToken = {
  address: string;
  decimals: number;
  linearPoolAddr: string;
  linearPoolId: string;
};

export type LinearPoolInfo = {
  address: string;
  id: string;
};

export type VirtualBoostedPoolInfo = {
  mainTokens: MainToken[];
  phantomStablePool: string;
  linearPools: LinearPoolInfo[];
};

export type VirtualBoostedPools = {
  [id: string]: VirtualBoostedPoolInfo;
};

type VirtualBoostedPoolPairData = {
  tokenIn: string;
  tokenOut: string;
  boostedPoolId: any;
  poolStates: { [address: string]: PoolState };
};

/*
VirtualBoostedPools are groups of pools that are connected in a pre-defined way.
Having a VirtualPool allows complexity of swapping between underlying tokens to be simplified/abstracted away as paths are already known and coded.
i.e. a VirtualBoostedPool exists consisting of Linear USDC/DAI/USDT pools connected with the bb-a-USDC PhantomStable, this VirtualPool shows its token list as USDC/DAI/USDT
*/
export class VirtualBoostedPool {
  /*
    VirtualBoostedPool information where a VirtualBoostedPool is a combination of Linear pools nested in a PhantomStable pool. i.e. bb-a-USD
    mainToken are the underlying mainTokens of the Linear Pools and will be seen as the tokens the VirtualPool contains.
    i.e. bb-a-USD VirtualBoostedPool will look like it has USDC, DAI, USDT and bb-a-USD_bpt
    phantomStablePool is the PhantomStablePool connecting all LinearPools
    linearPools is the list of LinearPools
    Initially this will be a hardcoded list but can be added to Subgraph to be more scalable.
    */
  static virtualBoostedPools: VirtualBoostedPools = {
    '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe': {
      mainTokens: [
        {
          address: '0x6b175474e89094c44da98b954eedeac495271d0f',
          decimals: 18,
          linearPoolAddr: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
          linearPoolId:
            '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
        }, // DAI
        {
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          decimals: 6,
          linearPoolAddr: '0x9210f1204b5a24742eba12f710636d76240df3d0',
          linearPoolId:
            '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
        }, // USDC
        {
          address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          decimals: 6,
          linearPoolAddr: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
          linearPoolId:
            '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c0000000000000000000000fd',
        }, // USDT
      ],
      phantomStablePool: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
      linearPools: [
        {
          address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
          id: '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
        }, // bbaDAI
        {
          address: '0x9210f1204b5a24742eba12f710636d76240df3d0',
          id: '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
        }, // bbaUSDC
        {
          address: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
          id: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c0000000000000000000000fd',
        }, // bbaUSDT
      ],
    },
  };

  vaultAddress: string;
  vaultInterface: Interface;
  linearPoolInterface: Interface;
  phantomStablePoolInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
    this.linearPoolInterface = new Interface(LinearPoolABI);
    this.phantomStablePoolInterface = new Interface(MetaStablePoolABI);
  }

  /*
    Create new 'VirtualBoosted' pool type from preconfigured info.
    */
  static getVirtualBoostedPools(pools: SubgraphPoolBase[]): SubgraphPoolBase[] {
    const virtualBoostedPools: SubgraphPoolBase[] = [];
    pools.forEach(pool => {
      if (this.virtualBoostedPools[pool.id])
        virtualBoostedPools.push({
          id: pool.id + '-virtualBoostedPool',
          address: pool.address,
          poolType: 'VirtualBoosted',
          tokens: this.virtualBoostedPools[pool.id].mainTokens,
          mainIndex: 0,
          wrappedIndex: 0,
        });
    });

    return virtualBoostedPools;
  }

  /*
    Creates multicall data for a VirtualBoostedPool which can be passed to multicall contract.
    Retrieves following onchain data:
    PhantomStable - scaling factors, amp (assumes poolTokens and swapFee are constructed elsewhere)
    LinearPools - (for each Linear Pool) pooltokens/balances, swapFee, scalingfactors, main/wrapped/bpt indices, targets
    */
  getOnChainCalls(pool: SubgraphPoolBase): callData[] {
    // Add calls for PhantomStable Pool
    const poolCallData: callData[] = [];
    // Add pool tokens for upper PhantomStablePool
    poolCallData.push({
      target: this.vaultAddress,
      callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
        pool.id.split('-virtualBoostedPool')[0],
      ]),
    });
    // Add swap fee for upper PhantomStablePool
    poolCallData.push({
      target: pool.address,
      callData: this.phantomStablePoolInterface.encodeFunctionData(
        'getSwapFeePercentage',
      ),
    });
    // Add scaling factors for upper PhantomStablePool
    poolCallData.push({
      target: pool.address,
      callData:
        this.phantomStablePoolInterface.encodeFunctionData('getScalingFactors'),
    });
    // Add amp parameter for upper PhantomStable Pool
    poolCallData.push({
      target: pool.address,
      callData: this.phantomStablePoolInterface.encodeFunctionData(
        'getAmplificationParameter',
      ),
    });

    // Add calls for each linear pool
    VirtualBoostedPool.virtualBoostedPools[
      pool.id.split('-virtualBoostedPool')[0]
    ].linearPools.forEach(linearPool => {
      poolCallData.push({
        target: this.vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          linearPool.id,
        ]),
      });
      poolCallData.push({
        target: linearPool.address,
        callData: this.linearPoolInterface.encodeFunctionData(
          'getSwapFeePercentage',
        ),
      });
      poolCallData.push({
        target: linearPool.address,
        callData:
          this.linearPoolInterface.encodeFunctionData('getScalingFactors'),
      });
      poolCallData.push({
        target: linearPool.address,
        callData: this.linearPoolInterface.encodeFunctionData('getMainIndex'),
      });
      poolCallData.push({
        target: linearPool.address,
        callData:
          this.linearPoolInterface.encodeFunctionData('getWrappedIndex'),
      });
      poolCallData.push({
        target: linearPool.address,
        callData: this.linearPoolInterface.encodeFunctionData('getBptIndex'),
      });
      // returns lowerTarget, upperTarget
      poolCallData.push({
        target: linearPool.address,
        callData: this.linearPoolInterface.encodeFunctionData('getTargets'),
      });
    });
    return poolCallData;
  }

  /*
    Decodes multicall data for a VirtualBoostedPool.
    data must contain returnData
    startIndex is where to start in returnData. Allows this decode function to be called along with other pool types.
    */
  decodeOnChainCalls(
    pool: SubgraphPoolBase,
    data: { success: boolean; returnData: any }[],
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    // TO DO - Change to use decodeThrowError
    const pools: { [address: string]: PoolState } = {};
    const poolTokens = this.vaultInterface.decodeFunctionResult(
      'getPoolTokens',
      data[startIndex++].returnData,
    );

    const swapFee = this.phantomStablePoolInterface.decodeFunctionResult(
      'getSwapFeePercentage',
      data[startIndex++].returnData,
    )[0];

    const scalingFactors = this.phantomStablePoolInterface.decodeFunctionResult(
      'getScalingFactors',
      data[startIndex++].returnData,
    )[0];

    const amp = this.phantomStablePoolInterface.decodeFunctionResult(
      'getAmplificationParameter',
      data[startIndex++].returnData,
    );

    const poolState: PoolState = {
      swapFee: BigInt(swapFee.toString()),
      tokens: poolTokens.tokens.reduce(
        (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
          const tokenState: TokenState = {
            balance: BigInt(poolTokens.balances[j].toString()),
          };

          if (scalingFactors)
            tokenState.scalingFactor = BigInt(scalingFactors[j].toString());

          ptAcc[pt.toLowerCase()] = tokenState;
          return ptAcc;
        },
        {},
      ),
    };

    poolState.amp = BigInt(amp.value.toString());

    pools[pool.address.toLowerCase()] = poolState;

    VirtualBoostedPool.virtualBoostedPools[
      pool.id.split('-virtualBoostedPool')[0]
    ].linearPools.forEach(linearPool => {
      const poolTokens = this.vaultInterface.decodeFunctionResult(
        'getPoolTokens',
        data[startIndex++].returnData,
      );

      const swapFee = this.linearPoolInterface.decodeFunctionResult(
        'getSwapFeePercentage',
        data[startIndex++].returnData,
      )[0];

      const scalingFactors = this.linearPoolInterface.decodeFunctionResult(
        'getScalingFactors',
        data[startIndex++].returnData,
      )[0];

      const mainIndex = this.linearPoolInterface.decodeFunctionResult(
        'getMainIndex',
        data[startIndex++].returnData,
      );

      const wrappedIndex = this.linearPoolInterface.decodeFunctionResult(
        'getWrappedIndex',
        data[startIndex++].returnData,
      );

      const bptIndex = this.linearPoolInterface.decodeFunctionResult(
        'getBptIndex',
        data[startIndex++].returnData,
      );

      const [lowerTarget, upperTarget] =
        this.linearPoolInterface.decodeFunctionResult(
          'getTargets',
          data[startIndex++].returnData,
        );

      const poolState: PoolState = {
        swapFee: BigInt(swapFee.toString()),
        mainIndex: Number(mainIndex),
        wrappedIndex: Number(wrappedIndex),
        bptIndex: Number(bptIndex),
        lowerTarget: BigInt(lowerTarget.toString()),
        upperTarget: BigInt(upperTarget.toString()),
        tokens: poolTokens.tokens.reduce(
          (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
            const tokenState: TokenState = {
              balance: BigInt(poolTokens.balances[j].toString()),
            };

            if (scalingFactors)
              tokenState.scalingFactor = BigInt(scalingFactors[j].toString());

            ptAcc[pt.toLowerCase()] = tokenState;
            return ptAcc;
          },
          {},
        ),
      };

      pools[linearPool.address] = poolState;
    });

    return [pools, startIndex];
  }

  // Finds the address and poolType the tokenAddr belongs to
  static getTokenPool(
    boostedPoolAddr: string,
    boostedPoolId: string,
    tokenAddr: string,
  ): {
    address: string;
    type: string;
    id: string;
  } {
    if (getAddress(boostedPoolAddr) === getAddress(tokenAddr))
      return {
        address: boostedPoolAddr,
        type: 'StablePhantom',
        id: 'TODO',
      };

    const boostedPool = VirtualBoostedPool.virtualBoostedPools[boostedPoolId];
    const index = boostedPool.mainTokens.findIndex(
      t => getAddress(t.address) === getAddress(tokenAddr),
    );
    if (index < 0) throw Error('Token missing');

    return {
      address: boostedPool.mainTokens[index].linearPoolAddr,
      type: 'Linear',
      id: boostedPool.mainTokens[index].linearPoolId,
    };
  }

  /*
  Helper function to parse pool data into params for onSell function.
  */
  parsePoolPairData(
    pool: SubgraphPoolBase,
    poolStates: { [address: string]: PoolState },
    tokenIn: string,
    tokenOut: string,
  ): VirtualBoostedPoolPairData {
    const poolPairData: VirtualBoostedPoolPairData = {
      tokenIn,
      tokenOut,
      boostedPoolId: pool.id,
      poolStates,
    };
    return poolPairData;
  }

  checkBalance(
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
    poolPairData: VirtualBoostedPoolPairData,
  ): boolean {
    // TO DO - Add this once agreed that VirtualPools are useful
    console.log(`!!!!!!! TO DO checkBalance`);
    return true;
  }

  /*
  scaling factors should include rate:
  The wrapped token's scaling factor is not constant, but increases over time as the wrapped token increases in value.
  i.e. 
  scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
      MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
  )
  */
  onSell(
    amounts: bigint[],
    poolPairData: VirtualBoostedPoolPairData,
  ): bigint[] {
    return this._calcOutGivenIn(
      amounts,
      poolPairData.tokenIn,
      poolPairData.tokenOut,
      poolPairData.boostedPoolId,
      poolPairData.poolStates,
    );
  }

  _calcOutGivenIn(
    tokenAmountsIn: bigint[],
    tokenIn: string,
    tokenOut: string,
    boostedPoolId: string,
    poolStates: { [address: string]: PoolState },
  ): bigint[] {
    const boostedPoolAddr =
      VirtualBoostedPool.virtualBoostedPools[
        boostedPoolId.split('-virtualBoostedPool')[0]
      ].phantomStablePool;
    if (!boostedPoolAddr) return [];

    const poolIn = VirtualBoostedPool.getTokenPool(
      boostedPoolAddr,
      boostedPoolId.split('-virtualBoostedPool')[0],
      tokenIn,
    );
    const poolOut = VirtualBoostedPool.getTokenPool(
      boostedPoolAddr,
      boostedPoolId.split('-virtualBoostedPool')[0],
      tokenOut,
    );
    const linearPool = new LinearPool(
      this.vaultAddress,
      this.linearPoolInterface,
    );
    const phantomStablePool = new PhantomStablePool(
      this.vaultAddress,
      this.phantomStablePoolInterface,
    );

    // Find where tokenIn/Out fits, i.e. boosted or phantom
    if (poolIn.type === 'Linear' && poolOut.type === 'Linear') {
      // i.e. DAI > USDC
      console.log(`tokenIn[Linear]inBpt[PhantomStable]outBpt[Linear]tokenOut`);
      // Find pools of interest
      const linearIn = poolStates[poolIn.address];
      const stablePhantom = poolStates[boostedPoolAddr];
      const linearOut = poolStates[poolOut.address];
      if (
        linearIn.bptIndex === undefined ||
        linearIn.mainIndex === undefined ||
        linearIn.wrappedIndex === undefined ||
        linearIn.lowerTarget === undefined ||
        linearIn.upperTarget === undefined ||
        stablePhantom.amp === undefined ||
        linearOut.bptIndex === undefined ||
        linearOut.mainIndex === undefined ||
        linearOut.wrappedIndex === undefined ||
        linearOut.lowerTarget === undefined ||
        linearOut.upperTarget === undefined
      )
        throw 'Pool missing data';

      const linearInTokens = Object.values(linearIn.tokens);
      const stablePhantomTokens = Object.values(stablePhantom.tokens);
      const linearOutTokens = Object.values(linearOut.tokens);
      const linearInTokenAddrs = Object.keys(linearIn.tokens);
      const linearOutTokenAddrs = Object.keys(linearOut.tokens);
      const stablePhantomTokenAddrs = Object.keys(stablePhantom.tokens);

      // First hop through Linear Pool of tokenIn
      const amtOutLinearOne = linearPool._swapGivenIn(
        tokenAmountsIn,
        linearInTokenAddrs,
        linearInTokens.map(t => t.balance),
        linearIn.mainIndex, // indexIn
        linearIn.bptIndex, // indexOut
        linearIn.bptIndex, // bptIndex
        linearIn.wrappedIndex, // wrappedIndex
        linearIn.mainIndex, // mainIndex
        linearInTokens.map(t => (t.scalingFactor ? t.scalingFactor : BZERO)),
        linearIn.swapFee,
        linearIn.lowerTarget,
        linearIn.upperTarget,
      );

      // Second hop through PhantomStable inbpt>outbpt
      const amtOutPhantomStable = phantomStablePool._swapGivenIn(
        amtOutLinearOne,
        stablePhantomTokenAddrs,
        stablePhantomTokens.map(t => t.balance),
        stablePhantomTokenAddrs.indexOf(linearInTokenAddrs[linearIn.bptIndex]), // indexIn
        stablePhantomTokenAddrs.indexOf(
          linearOutTokenAddrs[linearOut.bptIndex],
        ), // indexOut
        stablePhantomTokenAddrs.indexOf(boostedPoolAddr), // bptIndex
        stablePhantomTokens.map(t =>
          t.scalingFactor ? t.scalingFactor : BZERO,
        ),
        stablePhantom.swapFee,
        stablePhantom.amp,
      );

      // Last hop through Linear Pool of tokenOut
      const amtOutLinearTwo = linearPool._swapGivenIn(
        amtOutPhantomStable,
        Object.keys(linearOut.tokens),
        linearOutTokens.map(t => t.balance),
        linearOut.bptIndex, // indexIn
        linearOut.mainIndex, // indexOut
        linearOut.bptIndex, // bptIndex
        linearOut.wrappedIndex,
        linearOut.mainIndex, // mainIndex
        linearOutTokens.map(t => (t.scalingFactor ? t.scalingFactor : BZERO)),
        linearOut.swapFee,
        linearOut.lowerTarget,
        linearOut.upperTarget,
      );
      return amtOutLinearTwo;
    } else if (poolIn.type === 'Linear' && poolOut.type === 'StablePhantom') {
      // i.e. DAI>bbaUSD
      console.log(`tokenIn[Linear]inBpt[PhantomStable]tokenOut`);
      // TO DO - Add this implementation when agreed that VirtualPools are useful
    } else if (poolIn.type === 'StablePhantom' && poolOut.type === 'Linear') {
      // i.e. bbaUSD>DAI
      console.log(`tokenIn[PhantomStable]outBpt[Linear]tokenOut`);
      // TO DO - Add this implementation when agreed that VirtualPools are useful
    } else {
      console.error('Incorrect swap type');
      return [BZERO];
    }

    return [BZERO];
  }

  static getSwapData(
    tokenIn: string,
    tokenOut: string,
    boostedPoolId: string,
    amount: string,
  ): { swaps: BalancerSwap[]; assets: string[]; limits: string[] } {
    // this function could easily return swap data for a token pair
    // i.e. for DAI>USDC it would return tokenIn[Linear]inBpt[PhantomStable]outBpt[Linear]tokenOut in correct swap format
    const actualId = boostedPoolId.split('-virtualBoostedPool')[0];
    const virtualPoolInfo = this.virtualBoostedPools[actualId];
    const poolIn = this.getTokenPool(
      virtualPoolInfo.phantomStablePool,
      actualId,
      tokenIn,
    );
    const poolOut = this.getTokenPool(
      virtualPoolInfo.phantomStablePool,
      actualId,
      tokenOut,
    );

    // // Find where tokenIn/Out fits, i.e. boosted or phantom
    if (poolIn.type === 'Linear' && poolOut.type === 'Linear') {
      const assets = [tokenIn, poolIn.address, poolOut.address, tokenOut];
      const swaps = [
        {
          poolId: poolIn.id,
          assetInIndex: 0,
          assetOutIndex: 1,
          amount: amount,
          userData: '0x',
        },
        {
          poolId: actualId,
          assetInIndex: 1,
          assetOutIndex: 2,
          amount: '0',
          userData: '0x',
        },
        {
          poolId: poolOut.id,
          assetInIndex: 2,
          assetOutIndex: 3,
          amount: '0',
          userData: '0x',
        },
      ];
      // TO DO - Not safe?
      const limits = Array(assets.length).fill(MAX_INT);
      return {
        swaps,
        limits,
        assets,
      };
    } else if (poolIn.type === 'Linear' && poolOut.type === 'StablePhantom') {
      // i.e. DAI>bbaUSD
      console.log(`getSwapData: tokenIn[Linear]inBpt[PhantomStable]tokenOut`);
      // TO DO - Add this implementation when agreed that VirtualPools are useful
    } else if (poolIn.type === 'StablePhantom' && poolOut.type === 'Linear') {
      // i.e. bbaUSD>DAI
      console.log(`getSwapData: tokenIn[PhantomStable]outBpt[Linear]tokenOut`);
      // TO DO - Add this implementation when agreed that VirtualPools are useful
    } else {
      console.error('Incorrect swap type');
      return {} as any;
    }
    return {} as any;
  }
}
