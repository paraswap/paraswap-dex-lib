import _ from 'lodash';
import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import { CustomImplementationNames, PoolConstants, PoolState } from '../types';
import { BasePoolPolling, MulticallReturnedTypes } from './base-pool-polling';
import { uint256ToBigInt } from '../../../lib/decoders';
import { funcName, _require } from '../../../utils';
import { Address } from 'paraswap-core';
import { AbiItem } from 'web3-utils';

type FunctionToCall =
  | 'A'
  | 'totalSupply'
  | 'exchangeRateCurrent'
  | 'fee'
  | 'balances'
  | 'get_virtual_price';

const ContractABIs: Record<FunctionToCall, AbiItem> = {
  get_virtual_price: {
    name: 'get_virtual_price',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [],
    stateMutability: 'view',
    type: 'function',
    gas: 1133537,
  },
  totalSupply: {
    name: 'totalSupply',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [],
    stateMutability: 'view',
    type: 'function',
    gas: 1211,
  },
  exchangeRateCurrent: {
    constant: true,
    inputs: [],
    name: 'exchangeRateCurrent',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  A: {
    name: 'A',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [],
    stateMutability: 'view',
    type: 'function',
    gas: 5227,
  },
  fee: {
    name: 'fee',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [],
    stateMutability: 'view',
    type: 'function',
    gas: 2171,
  },
  balances: {
    name: 'balances',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [{ type: 'uint256', name: 'arg0' }],
    stateMutability: 'view',
    type: 'function',
    gas: 2250,
  },
};

// This class is very limited to speed up the process. I don't know if it is extensible
// for other pools. I just wanted to make support for custom pools that are used under
// factory meta pools
export class CustomBasePoolForFactory extends BasePoolPolling {

  constructor(
    readonly logger: Logger,
    readonly name: string,
    readonly implementationName: CustomImplementationNames,
    readonly address: Address,
    readonly poolIdentifier: string,
    readonly poolConstants: PoolConstants,
    readonly lpTokenAddress: Address,
    readonly useLending?: boolean[],
    readonly contractABIs = ContractABIs,
  ) {
    super(name, logger);
  }

  getStateMultiCalldata(): MultiCallParams<MulticallReturnedTypes>[] {
    let calls: MultiCallParams<MulticallReturnedTypes>[] = [
      {
        target: this.address,
        callData: this.abiCoder.encodeFunctionCall(this.contractABIs.A, []),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.address,
        callData: this.abiCoder.encodeFunctionCall(this.contractABIs.fee, []),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.address,
        callData: this.abiCoder.encodeFunctionCall(
          this.contractABIs.get_virtual_price,
          [],
        ),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.lpTokenAddress,
        callData: this.abiCoder.encodeFunctionCall(
          this.contractABIs.totalSupply,
          [],
        ),
        decodeFunction: uint256ToBigInt,
      },
      _.range(this.poolConstants.COINS.length).map(i => ({
        target: this.address,
        callData: this.abiCoder.encodeFunctionCall(this.contractABIs.balances, [
          i.toString(),
        ]),
        decodeFunction: uint256ToBigInt,
      })),
    ].flat();

    if (this.useLending) {
      const exchangeRateCalls = this.useLending
        .map((useLending, i) =>
          useLending
            ? {
                target: this.address,
                callData: this.abiCoder.encodeFunctionCall(
                  this.contractABIs.balances,
                  [i.toString()],
                ),
                decodeFunction: uint256ToBigInt,
              }
            : undefined,
        )
        .filter(
          cd => cd !== undefined,
        ) as MultiCallParams<MulticallReturnedTypes>[];
      calls = calls.concat(exchangeRateCalls);
    }

    return calls;
  }

  setState(
    multiOutputs: MultiResult<MulticallReturnedTypes>[],
    updatedAt: number,
  ): void {
    if (!multiOutputs.every(o => o.success)) {
      this.logger.error(
        `${this.CLASS_NAME} ${this.implementationName} ${
          this.name
        } ${funcName()}: Some of the calls for pool ${
          this.address
        } generate state failed: `,
      );
      // No need to update with corrupted state
      return;
    }

    const lastIndex = 3;
    const A = multiOutputs[0].returnData as bigint;
    const fee = multiOutputs[1].returnData as bigint;
    const virtualPrice = multiOutputs[2].returnData as bigint;
    const totalSupply = multiOutputs[lastIndex].returnData as bigint;

    const balances = multiOutputs
      .slice(lastIndex, lastIndex + this.poolConstants.COINS.length)
      .map(e => e.returnData) as bigint[];

    let exchangeRateCurrent: (bigint | undefined)[] | undefined;

    if (this.useLending) {
      exchangeRateCurrent = new Array(this.useLending.length).fill(undefined);
      const exchangeRateResults = multiOutputs
        .slice(lastIndex + this.poolConstants.COINS.length)
        .map(e => e.returnData) as bigint[];

      const indicesToFill = this.useLending.reduce<number[]>((acc, curr, i) => {
        if (curr) {
          acc.push(i);
        }
        return acc;
      }, []);
      _require(
        indicesToFill.length === exchangeRateResults.length,
        "indicesToFill and exchangeResults doesn't match",
        {
          indicesToFill: indicesToFill.length,
          exchangeRateResults: exchangeRateResults.length,
        },
        'indicesToFill.length === exchangeRateResults.length',
      );
      indicesToFill.forEach((indexToFill, currentIndex) => {
        exchangeRateResults[indexToFill] = exchangeRateResults[currentIndex];
      });
    }

    const newState: PoolState = {
      A,
      fee,
      balances,
      constants: this.poolConstants,
      exchangeRateCurrent,
      virtualPrice,
      totalSupply,
    };

    this._setState(newState, updatedAt);
  }
}
