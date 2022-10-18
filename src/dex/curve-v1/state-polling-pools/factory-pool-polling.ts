import { Interface, JsonFragment } from '@ethersproject/abi';
import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import { PoolConstants, PoolState } from '../types';
import { BasePoolPolling } from './base-pool-polling';
import FactoryCurveV1ABI from '../../../abi/curve-v1/FactoryCurveV1.json';
import { uint256ToBigInt } from '../../../lib/decoders';

export class FactoryStateHandler extends BasePoolPolling<PoolState> {
  constructor(
    name: string,
    readonly address: string,
    readonly factoryAddress: string,
    readonly poolIdentifier: string,
    logger: Logger,
    poolConstants: PoolConstants,
    private iface: Interface = new Interface(
      FactoryCurveV1ABI as JsonFragment[],
    ),
  ) {
    super(name, logger, poolConstants);
  }
  getStateMultiCalldata(): MultiCallParams<unknown>[] {
    return [
      {
        target: this.factoryAddress,
        callData: this.iface.encodeFunctionData('get_A', [this.address]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.factoryAddress,
        callData: this.iface.encodeFunctionData('get_A', [this.address]),
        decodeFunction: uint256ToBigInt,
      },
    ];
  }

  setState(multiOutputs: MultiResult<unknown>[], updatedAt: number): void {
    this._setState();
  }
}
