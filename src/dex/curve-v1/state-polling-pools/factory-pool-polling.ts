import { Interface, JsonFragment } from '@ethersproject/abi';
import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import { PoolConstants, PoolState } from '../types';
import { BasePoolPolling } from './base-pool-polling';
import FactoryCurveV1ABI from '../../../abi/curve-v1/FactoryCurveV1.json';
import { generalDecoder, uint256ToBigInt } from '../../../lib/decoders';
import { BytesLike } from 'ethers/lib/utils';
import { funcName } from '../../../utils';

export type MulticallReturnedTypes = bigint | bigint[];

export class FactoryStateHandler extends BasePoolPolling<
  PoolState,
  MulticallReturnedTypes
> {
  private isMetaPool: boolean;

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
    this.isMetaPool = this.poolConstants.BASE_COINS.length > 0;
  }
  getStateMultiCalldata(): MultiCallParams<MulticallReturnedTypes>[] {
    const calls = [
      {
        target: this.factoryAddress,
        callData: this.iface.encodeFunctionData('get_A', [this.address]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.factoryAddress,
        callData: this.iface.encodeFunctionData('get_fees', [this.address]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.factoryAddress,
        callData: this.iface.encodeFunctionData('get_balances', [this.address]),
        decodeFunction: (result: MultiResult<BytesLike>) =>
          generalDecoder(result, ['uint256[4]'], [0n, 0n, 0n, 0n], parsed =>
            parsed.map(p => BigInt(p.toString())),
          ),
      },
    ];
    if (this.isMetaPool) {
      calls.push({
        target: this.factoryAddress,
        callData: this.iface.encodeFunctionData('get_underlying_balances', [
          this.address,
        ]),
        decodeFunction: (result: MultiResult<BytesLike>) =>
          generalDecoder(
            result,
            ['uint256[8]'],
            [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
            parsed => parsed.map(p => BigInt(p.toString())),
          ),
      });
    }
    return calls;
  }

  setState(
    multiOutputs: MultiResult<MulticallReturnedTypes>[],
    updatedAt: number,
  ): void {
    if (!multiOutputs.every(o => o.success)) {
      this.logger.error(
        `${this.name} ${funcName()}: Some of the calls to ${
          this.address
        } generate state failed: `,
      );
      // No need to update with corrupted state
      return;
    }

    const [A, fees, balances, underlyingBalances] = multiOutputs.map(
      o => o.returnData,
    ) as [bigint, bigint[], bigint[], bigint[] | undefined];

    const newState: PoolState = {
      A,
      fee: fees[0], // Array has [fee, adminFee], but we want only fee
      balances: balances,
      constants: this.poolConstants,
    };

    this._setState(newState, updatedAt);
  }
}
