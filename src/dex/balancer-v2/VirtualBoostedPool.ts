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
import { BalancerPoolTypes } from './balancer-v2';

import LinearPoolABI from '../../abi/balancer-v2/linearPoolAbi.json';
import MetaStablePoolABI from '../../abi/balancer-v2/meta-stable-pool.json';

export type BoostedPools = {
  [id: string]: BoostedPool;
};

export type BoostedPool = {
  mainTokens: MainToken[];
  phantomStablePoolAddr: string;
};

export type MainToken = {
  address: string;
  decimals: number;
  linearPoolAddr: string;
  linearPoolId: string;
};

export type VirtualBoostedPools = {
  dictionary: BoostedPools;
  subgraph: SubgraphPoolBase[];
};

type BoostedPoolPairData = {
  tokenIn: string;
  tokenOut: string;
  phantomPoolId: any;
  poolStates: { [address: string]: PoolState };
  boostedPools: BoostedPools;
};

export type SwapData = {
  swaps: BalancerSwap[];
  assets: string[];
  limits: string[];
};

/*
VirtualBoostedPools are groups of pools that are connected in a pre-defined way.
Having a VirtualPool allows complexity of swapping between underlying tokens to be simplified/abstracted away as paths are already known and coded.
i.e. a VirtualBoostedPool exists consisting of Linear USDC/DAI/USDT pools connected with the bb-a-USDC PhantomStable, this VirtualPool shows its token list as USDC/DAI/USDT
*/
export class VirtualBoostedPool {
  /**
   * Creates VirtualBoostedPools from list of input pools. A VirtualBoostedPool is a combination of Linear pools nested in a PhantomStable pool. i.e. bb-a-USD.
   * @param pools Array of subgraph pools (should contain Phantom/Linear pools of interest)
   * @returns Array of VirtualBoosted subgraph pools. Dictionary object of virtualBoosted pool data.
   */
  static createPools(pools: SubgraphPoolBase[]): VirtualBoostedPools {
    const subgraph: SubgraphPoolBase[] = [];
    const boostedPools: BoostedPools = {};
    const phantomPools: SubgraphPoolBase[] = [];
    const linearDict: { [address: string]: SubgraphPoolBase } = {};
    // Create an initial list of phantom pools and dictionary of Linear pools.
    pools.forEach(p => {
      // Covers ERC4626 & Aave Linear Pools
      if (p.poolType.includes('Linear')) linearDict[p.address] = p;
      else if (p.poolType === BalancerPoolTypes.StablePhantom) {
        phantomPools.push(p);
      }
    });

    // Create a boostedPool for each phantom that consists of Linear BPTs.
    phantomPools.forEach(phantomPool => {
      const mainTokens: MainToken[] = [];
      const isBoosted = phantomPool.tokens.every(t => {
        if (t.address === phantomPool.address) return true;
        // Phantom pools contain their own BPT in tokens list
        else if (linearDict[t.address]) {
          // mainToken are the underlying mainTokens of the Linear Pools and will be seen as the tokens the VirtualPool contains.
          // i.e.bb - a - USD VirtualBoostedPool will look like it has USDC, DAI, USDT and bb - a - USD_bpt
          mainTokens.push({
            address:
              linearDict[t.address].tokens[linearDict[t.address].mainIndex]
                .address,
            decimals:
              linearDict[t.address].tokens[linearDict[t.address].mainIndex]
                .decimals,
            linearPoolAddr: t.address,
            linearPoolId: linearDict[t.address].id,
          });
          return true;
        } else return false; // BoostedPools must consist of Phantom + Linear
      });

      if (isBoosted) {
        // phantomStablePoolAddr is the PhantomStablePool connecting all LinearPools
        boostedPools[phantomPool.id] = {
          mainTokens,
          phantomStablePoolAddr: phantomPool.address,
        };
        subgraph.push({
          id: phantomPool.id + this.poolType.toLowerCase(),
          address: phantomPool.address + this.poolType.toLowerCase(),
          poolType: this.poolType,
          tokens: mainTokens,
          mainIndex: 0,
          wrappedIndex: 0,
          totalLiquidity: phantomPool.totalLiquidity,
        });
      }
    });

    return { dictionary: boostedPools, subgraph };
  }

  static poolType = 'VirtualBoosted';
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
    Creates multicall data for a VirtualBoostedPool which can be passed to multicall contract.
    Retrieves following onchain data:
    PhantomStable - scaling factors, amp (assumes poolTokens and swapFee are constructed elsewhere)
    LinearPools - (for each Linear Pool) pooltokens/balances, swapFee, scalingfactors, main/wrapped/bpt indices, targets
    */
  getOnChainCalls(
    pool: SubgraphPoolBase,
    virtualBoostedPools: BoostedPools,
  ): callData[] {
    // Add calls for PhantomStable Pool
    const poolCallData: callData[] = [];
    // Add pool tokens for upper PhantomStablePool
    const poolAddress = pool.address.split(
      VirtualBoostedPool.poolType.toLowerCase(),
    )[0];
    poolCallData.push({
      target: this.vaultAddress,
      callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
        pool.id.split(VirtualBoostedPool.poolType.toLowerCase())[0],
      ]),
    });
    // Add swap fee for upper PhantomStablePool
    poolCallData.push({
      target: poolAddress,
      callData: this.phantomStablePoolInterface.encodeFunctionData(
        'getSwapFeePercentage',
      ),
    });
    // Add scaling factors for upper PhantomStablePool
    poolCallData.push({
      target: poolAddress,
      callData:
        this.phantomStablePoolInterface.encodeFunctionData('getScalingFactors'),
    });
    // Add amp parameter for upper PhantomStable Pool
    poolCallData.push({
      target: poolAddress,
      callData: this.phantomStablePoolInterface.encodeFunctionData(
        'getAmplificationParameter',
      ),
    });

    // Add calls for each linear pool
    virtualBoostedPools[
      pool.id.split(VirtualBoostedPool.poolType.toLowerCase())[0]
    ].mainTokens.forEach(mt => {
      poolCallData.push({
        target: this.vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          mt.linearPoolId,
        ]),
      });
      poolCallData.push({
        target: mt.linearPoolAddr,
        callData: this.linearPoolInterface.encodeFunctionData(
          'getSwapFeePercentage',
        ),
      });
      poolCallData.push({
        target: mt.linearPoolAddr,
        callData:
          this.linearPoolInterface.encodeFunctionData('getScalingFactors'),
      });
      poolCallData.push({
        target: mt.linearPoolAddr,
        callData: this.linearPoolInterface.encodeFunctionData('getMainIndex'),
      });
      poolCallData.push({
        target: mt.linearPoolAddr,
        callData:
          this.linearPoolInterface.encodeFunctionData('getWrappedIndex'),
      });
      poolCallData.push({
        target: mt.linearPoolAddr,
        callData: this.linearPoolInterface.encodeFunctionData('getBptIndex'),
      });
      // returns lowerTarget, upperTarget
      poolCallData.push({
        target: mt.linearPoolAddr,
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
    boostedPools: BoostedPools,
  ): [{ [address: string]: PoolState }, number] {
    const linearPool = new LinearPool(
      this.vaultAddress,
      this.linearPoolInterface,
    );
    const phantomStablePool = new PhantomStablePool(
      this.vaultAddress,
      this.phantomStablePoolInterface,
    );
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
      gasCost: linearPool.gasCost * 2 + phantomStablePool.gasCost, // Linear <> Phantom <> Linear
    };

    poolState.amp = BigInt(amp.value.toString());

    pools[pool.address.toLowerCase()] = poolState;
    // Save PhantomStable pool state
    const phantomStableAddr = pool.address
      .split(VirtualBoostedPool.poolType.toLowerCase())[0]
      .toLowerCase();
    pools[phantomStableAddr] = poolState;
    pools[phantomStableAddr].gasCost = phantomStablePool.gasCost;

    boostedPools[
      pool.id.split(VirtualBoostedPool.poolType.toLowerCase())[0]
    ].mainTokens.forEach(mt => {
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
        gasCost: linearPool.gasCost,
      };

      pools[mt.linearPoolAddr] = poolState;
    });

    return [pools, startIndex];
  }

  // Finds the address and poolType the tokenAddr belongs to
  static getTokenPool(
    phantomPoolAddr: string,
    phantomPoolId: string,
    tokenAddr: string,
    boostedPools: BoostedPools,
  ): {
    address: string;
    type: string;
    id: string;
  } {
    if (getAddress(phantomPoolAddr) === getAddress(tokenAddr))
      return {
        address: phantomPoolAddr,
        type: 'StablePhantom',
        id: 'TO DO',
      };

    const boostedPool = boostedPools[phantomPoolId];
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
    boostedPools: BoostedPools,
  ): BoostedPoolPairData {
    const poolPairData: BoostedPoolPairData = {
      tokenIn,
      tokenOut,
      phantomPoolId: pool.id.split(
        VirtualBoostedPool.poolType.toLowerCase(),
      )[0],
      poolStates,
      boostedPools,
    };
    return poolPairData;
  }

  checkBalance(
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
    poolPairData: BoostedPoolPairData,
  ): boolean {
    // Limited by last Linear Pool main token balance. LinearIn > BPT is ~unlimited. PhantomStable has no swap limit.
    const phantomPoolAddr =
      poolPairData.boostedPools[poolPairData.phantomPoolId]
        .phantomStablePoolAddr;
    if (!phantomPoolAddr) false;

    const poolOut = VirtualBoostedPool.getTokenPool(
      phantomPoolAddr,
      poolPairData.phantomPoolId,
      poolPairData.tokenOut,
      poolPairData.boostedPools,
    );

    const linearPool = new LinearPool(
      this.vaultAddress,
      this.linearPoolInterface,
    );
    const balanceOut =
      poolPairData.poolStates[poolOut.address].tokens[
        poolPairData.tokenOut.toLowerCase()
      ].balance;
    const scalingFactor =
      poolPairData.poolStates[poolOut.address].tokens[
        poolPairData.tokenOut.toLowerCase()
      ].scalingFactor;
    if (!scalingFactor) return false;
    const poolOutLimit = linearPool.swapLimit(balanceOut, scalingFactor);
    const swapAmount =
      amounts[amounts.length - 1] > unitVolume
        ? amounts[amounts.length - 1]
        : unitVolume;
    return poolOutLimit > swapAmount;
  }

  onSell(amounts: bigint[], poolPairData: BoostedPoolPairData): bigint[] {
    return this._calcOutGivenIn(
      amounts,
      poolPairData.tokenIn,
      poolPairData.tokenOut,
      poolPairData.phantomPoolId,
      poolPairData.poolStates,
      poolPairData.boostedPools,
    );
  }

  _calcOutGivenIn(
    tokenAmountsIn: bigint[],
    tokenIn: string,
    tokenOut: string,
    phantomPoolId: string,
    poolStates: { [address: string]: PoolState },
    boostedPools: BoostedPools,
  ): bigint[] {
    const phantomPoolAddr = boostedPools[phantomPoolId].phantomStablePoolAddr;
    if (!phantomPoolAddr) return [];

    const poolIn = VirtualBoostedPool.getTokenPool(
      phantomPoolAddr,
      phantomPoolId,
      tokenIn,
      boostedPools,
    );
    const poolOut = VirtualBoostedPool.getTokenPool(
      phantomPoolAddr,
      phantomPoolId,
      tokenOut,
      boostedPools,
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
      // console.log(`tokenIn[Linear]inBpt[PhantomStable]outBpt[Linear]tokenOut`);
      // Find pools of interest
      const linearIn = poolStates[poolIn.address];
      const stablePhantom = poolStates[phantomPoolAddr];
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
        stablePhantomTokenAddrs.indexOf(phantomPoolAddr), // bptIndex
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
      poolStates[
        phantomPoolAddr + VirtualBoostedPool.poolType.toLowerCase()
      ].gasCost = linearPool.gasCost * 2 + phantomStablePool.gasCost;
      return amtOutLinearTwo;
    } else {
      return [BZERO];
    }
  }

  static getSwapData(
    tokenIn: string,
    tokenOut: string,
    boostedPoolId: string,
    amount: string,
    boostedPools: BoostedPools,
  ): SwapData {
    // this function could easily return swap data for a token pair
    // i.e. for DAI>USDC it would return tokenIn[Linear]inBpt[PhantomStable]outBpt[Linear]tokenOut in correct swap format
    const actualId = boostedPoolId.split(
      VirtualBoostedPool.poolType.toLowerCase(),
    )[0];
    const virtualPoolInfo = boostedPools[actualId];
    if (!virtualPoolInfo) throw Error('Invalid VirtualBoostedPool ID');

    const poolIn = this.getTokenPool(
      virtualPoolInfo.phantomStablePoolAddr,
      actualId,
      tokenIn,
      boostedPools,
    );
    const poolOut = this.getTokenPool(
      virtualPoolInfo.phantomStablePoolAddr,
      actualId,
      tokenOut,
      boostedPools,
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
    } else {
      return {} as SwapData;
    }
  }
}
