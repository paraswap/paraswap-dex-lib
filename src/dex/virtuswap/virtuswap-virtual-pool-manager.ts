import { parseInt } from 'lodash';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { PlainVirtualPoolState } from './types';
import { Address, Logger } from '../../types';
import vPoolManagerABI from '../../abi/virtuswap/vPoolManager.json';
import { bigIntify, normalizeAddress, stringify } from '../../utils';
import { IDexHelper } from '../../dex-helper';

export class VirtuSwapVirtualPoolManager {
  vPoolManagerContract: Contract;

  constructor(
    protected dexHelper: IDexHelper,
    protected logger: Logger,
    protected vPoolManagerAddress: Address,
  ) {
    this.vPoolManagerContract = new dexHelper.web3Provider.eth.Contract(
      vPoolManagerABI as AbiItem[],
      vPoolManagerAddress,
    );
  }

  async getVirtualPoolFromChain(
    jkPair: Address,
    ikPair: Address,
    blockNumber?: number | string,
  ): Promise<PlainVirtualPoolState> {
    const virtualPool: Record<keyof PlainVirtualPoolState, any> =
      await this.vPoolManagerContract.methods
        .getVirtualPool(jkPair, ikPair)
        .call(undefined, blockNumber);

    return {
      fee: parseInt(virtualPool.fee),
      token0: normalizeAddress(stringify(virtualPool.token0)),
      token1: normalizeAddress(stringify(virtualPool.token1)),
      balance0: bigIntify(virtualPool.balance0),
      balance1: bigIntify(virtualPool.balance1),
      commonToken: normalizeAddress(stringify(virtualPool.commonToken)),
      jkPair: normalizeAddress(stringify(virtualPool.jkPair)),
      ikPair: normalizeAddress(stringify(virtualPool.ikPair)),
    };
  }

  async getVirtualPoolsFromChain(
    token0: Address,
    token1: Address,
    blockNumber?: number | string,
  ): Promise<PlainVirtualPoolState[]> {
    const virtualPools = await this.vPoolManagerContract.methods
      .getVirtualPools(token0, token1)
      .call(undefined, blockNumber);

    return virtualPools.map(
      (virtualPool: Record<keyof PlainVirtualPoolState, any>) => ({
        fee: parseInt(virtualPool.fee),
        token0: normalizeAddress(stringify(virtualPool.token0)),
        token1: normalizeAddress(stringify(virtualPool.token1)),
        balance0: bigIntify(virtualPool.balance0),
        balance1: bigIntify(virtualPool.balance1),
        commonToken: normalizeAddress(stringify(virtualPool.commonToken)),
        jkPair: normalizeAddress(stringify(virtualPool.jkPair)),
        ikPair: normalizeAddress(stringify(virtualPool.ikPair)),
      }),
    );
  }
}
