import _ from 'lodash';
import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import { ImplementationNames, PoolConstants, PoolState } from '../types';
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
  | 'get_virtual_price'
  | 'offpeg_fee_multiplier';

// There are many ABIs from different contracts. In order to not bring all of them
// in repository, I just picked only the ones I am using. I think it is more neat and readable,
// rather then having all ABIs
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
  offpeg_fee_multiplier: {
    stateMutability: 'view',
    type: 'function',
    name: 'offpeg_fee_multiplier',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    gas: 3408,
  },
};

// This class is very limited to speed up the process. I don't know if it is extensible
// for other pools. I just wanted to make support for custom pools that are used under
// factory meta pools
export class CustomBasePoolForFactory extends BasePoolPolling {
  constructor(
    readonly logger: Logger,
    readonly dexKey: string,
    readonly implementationName: ImplementationNames,
    readonly address: Address,
    readonly poolIdentifier: string,
    readonly poolConstants: PoolConstants,
    readonly curveLiquidityApiSlug: string,
    readonly lpTokenAddress: Address,
    readonly isLending: boolean,
    readonly useLending?: boolean[],
    readonly isUsedForPricing: boolean = false,
    readonly contractABIs = ContractABIs,
  ) {
    // Current custom pools are always plain
    super(
      logger,
      dexKey,
      implementationName,
      poolIdentifier,
      poolConstants,
      address,
      curveLiquidityApiSlug,
      undefined,
      false,
    );
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

    // this.USE_LENDING and isLending are not really related
    if (this.isLending) {
      calls.push({
        target: this.address,
        callData: this.abiCoder.encodeFunctionCall(
          this.contractABIs.offpeg_fee_multiplier,
          [],
        ),
        decodeFunction: uint256ToBigInt,
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
        `${this.CLASS_NAME} ${this.implementationName} ${
          this.dexKey
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

    let lastEndIndex = lastIndex + 1;
    if (this.useLending) {
      exchangeRateCurrent = new Array(this.useLending.length).fill(undefined);
      const exchangeRateResults = multiOutputs
        .slice(lastEndIndex, lastEndIndex + this.useLending.length)
        .map(e => e.returnData) as bigint[];

      lastEndIndex += this.useLending.length;
      // We had array with booleans and I filtered of `false` and sent request.
      // So, now I must map that results to original indices. That is the reason of this complication
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

    let offpeg_fee_multiplier: bigint | undefined;

    if (this.isLending) {
      offpeg_fee_multiplier = multiOutputs[lastEndIndex].returnData as bigint;
      lastEndIndex++;
    }

    const newState: PoolState = {
      A,
      fee,
      balances,
      constants: this.poolConstants,
      exchangeRateCurrent,
      virtualPrice,
      totalSupply,
      offpeg_fee_multiplier,
    };

    this._setState(newState, updatedAt);
  }
}
