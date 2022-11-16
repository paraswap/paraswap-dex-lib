import _ from 'lodash';
import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import {
  ImplementationNames,
  PoolConstants,
  PoolContextConstants,
  PoolState,
} from '../types';
import { PoolPollingBase, MulticallReturnedTypes } from './pool-polling-base';
import { uint256ToBigInt } from '../../../lib/decoders';
import { _require } from '../../../utils';
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
    inputs: [{ type: 'uint256', name: '' }],
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
export class CustomBasePoolForFactory extends PoolPollingBase {
  // We don't have any fee on transfer tokens for custom pools yet.
  // Created separate value to not forget to change in different places after
  // add support for all pools
  static IS_SRC_FEE_ON_TRANSFER_SUPPORTED: false;

  constructor(
    readonly logger: Logger,
    readonly dexKey: string,
    readonly implementationName: ImplementationNames,
    readonly address: Address,
    readonly poolIdentifier: string,
    readonly poolConstants: PoolConstants,
    readonly poolContextConstants: PoolContextConstants,
    readonly curveLiquidityApiSlug: string,
    readonly lpTokenAddress: Address,
    readonly isLendingPool: boolean,
    readonly balancesInputType: string,
    readonly useLending?: boolean[],
    readonly isUsedForPricing: boolean = false,
    readonly contractABIs = ContractABIs,
  ) {
    // Current custom pools are always plain
    super(
      logger,
      dexKey,
      implementationName,
      address,
      poolIdentifier,
      poolConstants,
      address,
      curveLiquidityApiSlug,
      isLendingPool,
      undefined,
      CustomBasePoolForFactory.IS_SRC_FEE_ON_TRANSFER_SUPPORTED,
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
        callData: this.abiCoder.encodeFunctionCall(
          this._getBalancesABI(this.balancesInputType),
          [i.toString()],
        ),
        decodeFunction: uint256ToBigInt,
      })),
    ].flat();

    if (this.useLending) {
      const exchangeRateCalls = this.useLending
        .map((useLending, i) =>
          useLending
            ? {
                target: this.poolConstants.COINS[i],
                callData: this.abiCoder.encodeFunctionCall(
                  this.contractABIs.exchangeRateCurrent,
                  [],
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
    if (this.isLendingPool) {
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
        `${this.CLASS_NAME} ${this.implementationName} ${this.dexKey} setState: Some of the calls for pool ${this.address} generate state failed: `,
      );
      // No need to update with corrupted state
      return;
    }

    const A = multiOutputs[0].returnData as bigint;
    const fee = multiOutputs[1].returnData as bigint;
    const virtualPrice = multiOutputs[2].returnData as bigint;
    const totalSupply = multiOutputs[3].returnData as bigint;
    const lastIndex = 4;

    const balances = multiOutputs
      .slice(lastIndex, lastIndex + this.poolConstants.COINS.length)
      .map(e => e.returnData) as bigint[];

    let exchangeRateCurrent: (bigint | undefined)[] | undefined;

    let lastEndIndex = lastIndex + 1;
    if (this.useLending) {
      exchangeRateCurrent = new Array(this.useLending.length).fill(undefined);
      const exchangeRateResults = multiOutputs
        .slice(
          lastEndIndex,
          // Filter false elements before checking length
          lastEndIndex + this.useLending.filter(el => el).length,
        )
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

    if (this.isLendingPool) {
      offpeg_fee_multiplier = multiOutputs[lastEndIndex].returnData as bigint;
      lastEndIndex++;
    }

    if (this._poolState === null) {
      this._poolState = {
        A: this.poolContextConstants.A_PRECISION
          ? A * this.poolContextConstants.A_PRECISION
          : A,
        fee,
        balances,
        constants: this.poolConstants,
        exchangeRateCurrent,
        virtualPrice,
        totalSupply,
        offpeg_fee_multiplier,
      };
    } else {
      this._poolState.A = this.poolContextConstants.A_PRECISION
        ? A * this.poolContextConstants.A_PRECISION
        : A;
      this._poolState.fee = fee;
      this._poolState.exchangeRateCurrent = exchangeRateCurrent;
      this._poolState.virtualPrice = virtualPrice;
      this._poolState.totalSupply = totalSupply;
      this._poolState.offpeg_fee_multiplier = offpeg_fee_multiplier;

      _require(
        this._poolState.balances.length === balances.length,
        `New state balances.length doesn't match old state balances.length`,
        { oldState: this._poolState.balances, newState: balances },
        'this._poolState.balances.length === state.balances.length',
      );

      for (const [i, _] of this._poolState.balances.entries()) {
        this._poolState.balances[i] = balances[i];
      }

      // I skip state.constants update as they are not changing
    }
    this._stateLastUpdatedAt = updatedAt;
  }

  private _getBalancesABI(type: string): AbiItem {
    const newBalancesType = _.cloneDeep(this.contractABIs.balances);
    newBalancesType.inputs![0].type = type;
    return newBalancesType;
  }
}
