import { Interface, JsonFragment } from '@ethersproject/abi';
import { Logger } from 'log4js';
import { MultiCallParams, MultiResult } from '../../../lib/multi-wrapper';
import {
  FactoryImplementationNames,
  PoolConstants,
  PoolContextConstants,
  PoolState,
} from '../types';
import { PoolPollingBase, MulticallReturnedTypes } from './pool-polling-base';
import FactoryCurveV1ABI from '../../../abi/curve-v1-factory/FactoryCurveV1.json';
import { generalDecoder, uint256ToBigInt } from '../../../lib/decoders';
import { BytesLike } from 'ethers/lib/utils';
import { Address } from '@paraswap/core';
import { BigNumber } from 'ethers';
import { _require } from '../../../utils';
import { IDexHelper } from '../../../dex-helper';

const DEFAULT_2_ZERO_ARRAY = [0n, 0n];
const DEFAULT_4_ZERO_ARRAY = [0n, 0n, 0n, 0n];

const getStoredRatesABI = (n: number) => ({
  name: 'stored_rates',
  stateMutability: 'view',
  type: 'function',
  inputs: [],
  outputs: [{ name: '', type: `uint256[${n}]` }],
});

export class FactoryStateHandler extends PoolPollingBase {
  constructor(
    readonly logger: Logger,
    readonly dexKey: string,
    dexHelper: IDexHelper,
    cacheStateKey: string,
    readonly implementationName: FactoryImplementationNames,
    implementationAddress: Address,
    readonly address: Address,
    stateUpdatePeriodMs: number,
    readonly factoryAddress: Address,
    readonly poolIdentifier: string,
    readonly poolConstants: PoolConstants,
    readonly poolContextConstants: PoolContextConstants,
    readonly isSrcFeeOnTransferSupported: boolean,
    baseStatePoolPolling?: PoolPollingBase,
    customGasCost?: number,
    readonly isStoredRatesSupported: boolean = false,
    private factoryIface: Interface = new Interface(
      FactoryCurveV1ABI as JsonFragment[],
    ),
    private additionalFuncsIface: Interface = new Interface([
      getStoredRatesABI(poolContextConstants.N_COINS),
    ]),
  ) {
    super(
      logger,
      dexKey,
      dexHelper,
      cacheStateKey,
      implementationName,
      implementationAddress,
      stateUpdatePeriodMs,
      poolIdentifier,
      poolConstants,
      address,
      '/factory',
      false,
      baseStatePoolPolling,
      isSrcFeeOnTransferSupported,
      customGasCost,
    );

    if (this.isMetaPool && this.baseStatePoolPolling === undefined) {
      throw new Error(
        `${this.fullName}: is instantiated with error. basePoolStateFetcher is not provided`,
      );
    }
  }

  protected _getFetchStateMultiCalls(): MultiCallParams<MulticallReturnedTypes>[] {
    const calls = [
      {
        target: this.factoryAddress,
        callData: this.factoryIface.encodeFunctionData('get_A', [this.address]),
        decodeFunction: uint256ToBigInt,
      },
      {
        target: this.factoryAddress,
        callData: this.factoryIface.encodeFunctionData('get_fees', [
          this.address,
        ]),
        decodeFunction: (result: MultiResult<BytesLike> | BytesLike) =>
          generalDecoder(
            result,
            ['uint256', 'uint256'],
            DEFAULT_2_ZERO_ARRAY,
            parsed => parsed.map((p: BigNumber) => p.toBigInt()),
          ),
      },
      {
        target: this.factoryAddress,
        callData: this.factoryIface.encodeFunctionData('get_balances', [
          this.address,
        ]),
        decodeFunction: (result: MultiResult<BytesLike> | BytesLike) =>
          generalDecoder(result, ['uint256[4]'], DEFAULT_4_ZERO_ARRAY, parsed =>
            parsed[0].map((p: BigNumber) => p.toBigInt()),
          ),
      },
    ];

    if (this.isStoredRatesSupported) {
      calls.push({
        target: this.address,
        callData: this.additionalFuncsIface.encodeFunctionData(
          'stored_rates',
          [],
        ),
        decodeFunction: (result: MultiResult<BytesLike> | BytesLike) =>
          generalDecoder(
            result,
            [`uint256[${this.poolContextConstants.N_COINS}]`],
            new Array(this.poolContextConstants.N_COINS).fill(0n),
            parsed => parsed[0].map((p: BigNumber) => p.toBigInt()),
          ),
      });
    }

    return calls;
  }

  protected async _parseStateFromMultiResults(
    multiOutputs: MulticallReturnedTypes[],
  ): Promise<PoolState> {
    const [A, fees, balances, storedRates] = multiOutputs as [
      bigint,
      bigint[],
      bigint[],
      bigint[] | undefined,
    ];

    let basePoolState: PoolState | undefined;
    if (this.isMetaPool) {
      // Check for undefined done in constructor
      const retrievedBasePoolState =
        await this.baseStatePoolPolling!.getState();

      if (retrievedBasePoolState === null) {
        throw new Error(
          `${this.CLASS_NAME} ${this.dexKey} ${this.address}: Can not retrieve base pool state`,
        );
      }
      basePoolState = retrievedBasePoolState.value;
    }

    return {
      A: this.poolContextConstants.A_PRECISION
        ? A * this.poolContextConstants.A_PRECISION
        : A,
      fee: fees[0], // Array has [fee, adminFee], but we want only fee
      balances: balances,
      constants: this.poolConstants,
      basePoolState,
      storedRates,
    };
  }
}
