import _ from 'lodash';
import { ethers } from 'ethers';
import { Interface } from '@ethersproject/abi';
import { Address } from 'paraswap';
import { NULL_ADDRESS } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { MultiCallParams, MultiWrapper } from '../../lib/multi-wrapper';
import { Logger, Token } from '../../types';
import { _require } from '../../utils';
import { dexPriceAggregatorUniswapV3 } from './contract-math/DexPriceAggregatorUniswapV3';
import { OracleLibrary } from './contract-math/OracleLibrary';
import {
  DexParams,
  LatestRoundData,
  OnchainConfigValues,
  OracleObservation,
  PoolKey,
  PoolState,
  Slot0,
} from './types';
import {
  addressDecode,
  booleanDecode,
  bytes32ToString,
  uint24ToBigInt,
  uint8ToNumber,
  uintDecode,
} from '../../lib/decoders';
import {
  decodeLatestRoundData,
  decodeObserveTickCumulatives,
  decodeOracleObservation,
  decodeUniswapV3Slot0,
  encodeStringToBytes32,
  synthStatusDecoder,
} from './utils';
import {
  Contracts,
  EXCHANGE_RATES_CONTRACT_NAME,
  SETTING_ATOMIC_EQUIVALENT_FOR_DEX_PRICING,
  SETTING_ATOMIC_EXCHANGE_FEE_RATE,
  SETTING_ATOMIC_TWAP_WINDOW,
  SETTING_CONTRACT_NAME,
  SETTING_DEX_PRICE_AGGREGATOR,
  SETTING_EXCHANGE_FEE_RATE,
  SETTING_PURE_CHAINLINK_PRICE_FOR_ATOMIC_SWAPS_ENABLED,
} from './constants';

export class SynthetixState {
  logger: Logger;

  // updatedAt may be blockNumber or timestamp
  fullState?: { updatedAt: number; values: PoolState };

  onchainConfigValues?: OnchainConfigValues;

  constructor(
    private dexKey: string,
    private dexHelper: IDexHelper,
    private multiWrapper: MultiWrapper,
    private combinedIface: Interface,
    private config: DexParams,
  ) {
    this.logger = this.dexHelper.getLogger('SynthetixState');
  }

  async updateOnchainConfigValues(blockNumber?: number) {
    this.onchainConfigValues = await this.getOnchainConfigValues(blockNumber);
  }

  getState(validForTime?: number): PoolState | undefined {
    if (
      validForTime === undefined ||
      (this.fullState && this.fullState.updatedAt < validForTime)
    ) {
      return this.fullState?.values;
    }
    return undefined;
  }

  async getOnchainState(blockNumber?: number): Promise<PoolState> {
    if (this.onchainConfigValues === undefined)
      throw new Error(
        `${this.dexKey} is not initialized, but received pricing request`,
      );

    const addressesFromPK = this.onchainConfigValues.poolKeys.map(pk =>
      dexPriceAggregatorUniswapV3.getPoolForRoute(
        this.onchainConfigValues!.dexPriceAggregator.uniswapV3Factory,
        this.onchainConfigValues!.dexPriceAggregator.overriddenPoolForRoute,
        pk,
      ),
    );

    const [packCounter, slot0TickCumulativesAndSuspensionsCallData] =
      this._buildObserveSlot0AndSuspensionsCallData(addressesFromPK);
    const slot0TickCumulativesAndSuspensions = (
      await this.multiWrapper.tryAggregate<
        Record<0 | 1, bigint> | Slot0 | boolean[] | boolean
      >(true, slot0TickCumulativesAndSuspensionsCallData, blockNumber)
    ).map(d => d.returnData) as (Record<0 | 1, bigint> | boolean | boolean[])[];

    const slot0AndTickCumulatives = slot0TickCumulativesAndSuspensions.slice(
      0,
      addressesFromPK.length * packCounter,
    );

    const suspensions = slot0TickCumulativesAndSuspensions.slice(
      addressesFromPK.length * packCounter,
    );

    const isSystemSuspended = suspensions[0] as boolean;

    const synthSuspensions = suspensions[1] as boolean[];

    const synthExchangeSuspensions = suspensions[2] as boolean[];

    const areSynthsSuspended = Object.keys(
      this.onchainConfigValues.addressToKey,
    ).reduce<Record<string, boolean>>((acc, curr, i) => {
      acc[curr] =
        synthSuspensions[i] === true || synthExchangeSuspensions[i] === true;
      return acc;
    }, {});

    const uniswapV3Slot0: Record<Address, Slot0> = {};
    const tickCumulatives: Record<Address, Record<0 | 1, bigint>> = {};

    _.chunk(slot0AndTickCumulatives, packCounter).map((result, i) => {
      const address = addressesFromPK[i];
      const [tickCumulative, slot0] = result as [Record<0 | 1, bigint>, Slot0];

      uniswapV3Slot0[address] = slot0;
      tickCumulatives[address] = tickCumulative;
    });

    const aggregatorAddressesWithoutZeros = Object.entries(
      this.onchainConfigValues.aggregatorsAddresses,
    ).reduce<Record<string, Address>>((acc, curr) => {
      const [key, address] = curr;
      if (address !== NULL_ADDRESS) {
        acc[key] = address;
      }
      return acc;
    }, {});

    const [_packCounter, observationsRoundAndOverriddenCallData] =
      this._buildObservationsRoundAndOverriddenCallData(
        addressesFromPK,
        uniswapV3Slot0,
        aggregatorAddressesWithoutZeros,
      );

    const [block, observationsRoundDataAndOverridden] = await Promise.all([
      this.dexHelper.web3Provider.eth.getBlock(blockNumber || 'latest'),
      this.multiWrapper.tryAggregate<
        OracleObservation | LatestRoundData | string
      >(true, observationsRoundAndOverriddenCallData, blockNumber),
    ]);

    const observations = observationsRoundDataAndOverridden
      .slice(0, addressesFromPK.length * packCounter)
      .map(e => e.returnData) as OracleObservation[];

    const latestRoundDatas = observationsRoundDataAndOverridden
      .slice(
        addressesFromPK.length * packCounter,
        -this.onchainConfigValues.poolKeys.length,
      )
      .map(e => e.returnData) as LatestRoundData[];

    const overriddenPools = observationsRoundDataAndOverridden
      .slice(-this.onchainConfigValues.poolKeys.length)
      .map(e => e.returnData) as string[];

    const overriddenPoolForRoute = overriddenPools.reduce<
      Record<string, Address>
    >((acc, curr, i) => {
      acc[
        dexPriceAggregatorUniswapV3.identifyRouteFromPoolKey(
          this.onchainConfigValues!.poolKeys[i],
        )
      ] = curr;
      return acc;
    }, {});

    const aggregators = latestRoundDatas.reduce<
      Record<Address, LatestRoundData>
    >((acc, cur, i) => {
      acc[Object.keys(aggregatorAddressesWithoutZeros)[i]] = cur;
      return acc;
    }, {});

    const uniswapV3Observations = _.chunk(observations, packCounter).reduce<
      Record<Address, Record<number, OracleObservation>>
    >((acc, cur, i) => {
      const address = addressesFromPK[i];
      const slot0 = uniswapV3Slot0[address];
      const [currentObservation, prevObservation] = cur;
      acc[address] = {
        [Number(slot0.observationIndex)]: currentObservation,
        [Number(
          slot0.observationCardinality !== 0n
            ? OracleLibrary.getPrevIndex(
                slot0.observationIndex,
                slot0.observationCardinality,
              )
            : 0n,
        )]: prevObservation,
      };
      return acc;
    }, {});

    const newState: PoolState = {
      atomicExchangeFeeRate: this.onchainConfigValues.atomicExchangeFeeRate,
      exchangeFeeRate: this.onchainConfigValues.atomicExchangeFeeRate,
      pureChainlinkPriceForAtomicSwapsEnabled:
        this.onchainConfigValues.pureChainlinkPriceForAtomicSwapsEnabled,
      atomicEquivalentForDexPricing:
        this.onchainConfigValues.atomicEquivalentForDexPricing,
      atomicTwapWindow: this.onchainConfigValues.atomicTwapWindow,
      dexPriceAggregator: {
        weth: this.onchainConfigValues.dexPriceAggregator.weth,
        defaultPoolFee:
          this.onchainConfigValues.dexPriceAggregator.defaultPoolFee,
        uniswapV3Factory:
          this.onchainConfigValues.dexPriceAggregator.uniswapV3Factory,
        overriddenPoolForRoute,
        uniswapV3Slot0,
        uniswapV3Observations,
        tickCumulatives,
      },
      sUSDCurrencyKey:
        this.onchainConfigValues.addressToKey[this.config.sUSDAddress],
      aggregatorDecimals: this.onchainConfigValues.aggregatorDecimals,
      blockTimestamp: BigInt(block.timestamp),
      aggregators,
      isSystemSuspended,
      areSynthsSuspended,
    };

    this.fullState = {
      updatedAt: blockNumber || 0,
      values: newState,
    };

    return newState;
  }

  async getOnchainConfigValues(
    blockNumber?: number,
  ): Promise<OnchainConfigValues> {
    // There are four onchain calls for one state update
    // I deliberately don't split into meaningful functions to not add additional
    // Promises on top of the ones I already use

    const [
      targetAddress,
      dexPriceAggregatorAddress,
      atomicTwapWindow,
      ...synthsAddresses
    ] = (
      await this.multiWrapper.tryAggregate<string | bigint>(
        true,
        this._buildInitialStateCallData(),
        blockNumber,
      )
    ).map(d => d.returnData) as [Address, Address, bigint, ...Address[]];

    const [
      synthetixAddress,
      exchangerAddress,
      exchangeRatesAddress,
      systemStatusAddress,
      weth,
      uniswapV3Factory,
      defaultPoolFee,
      ...synthCurrencyKeys
    ] = (
      await this.multiWrapper.tryAggregate<string | number | bigint>(
        true,
        this._buildResolverAggregatorAndCurrencyCallData(
          targetAddress,
          dexPriceAggregatorAddress,
          synthsAddresses,
        ),
        blockNumber,
      )
    ).map(d => d.returnData) as [
      Address,
      Address,
      Address,
      Address,
      Address,
      Address,
      bigint,
      ...string[]
    ];

    _require(
      synthCurrencyKeys.length === this.config.synths.length,
      `Number of currencyKeys=${synthCurrencyKeys.length} doesn't match the number of synth=${this.config.synths.length} in config`,
    );

    const addressToKey = this.config.synths.reduce<Record<Address, string>>(
      (acc, curr, i) => {
        const _tokenAddress = curr.toLowerCase();
        acc[_tokenAddress] = synthCurrencyKeys[i];
        return acc;
      },
      {},
    );

    // This packCounter value updated automatically and used later to make difference between different value in array
    let [packCounter, flexibleStorageCurrencyCallData] =
      this._buildFlexibleStorageCurrencyCallData(
        synthCurrencyKeys,
        exchangeRatesAddress,
      );

    const results = (
      await this.multiWrapper.tryAggregate<bigint | boolean | string | number>(
        true,
        flexibleStorageCurrencyCallData,
        blockNumber,
      )
    ).map(d => d.returnData);

    const atomicExchangeFeeRate: Record<string, bigint> = {};
    const exchangeFeeRate: Record<string, bigint> = {};
    const pureChainlinkPriceForAtomicSwapsEnabled: Record<string, boolean> = {};
    const atomicEquivalentForDexPricing: Record<string, Token> = {};
    const aggregatorsAddresses: Record<string, Address> = {};
    const aggregatorDecimals: Record<string, number> = {};

    _.chunk(results, packCounter).map((result, i) => {
      const currencyKey = synthCurrencyKeys[i];
      const [
        atomicExchangeFeeRateValue,
        exchangeFeeRateValue,
        pureChainlinkPriceForAtomicSwapsEnabledValue,
        atomicEquivalentForDexPricingValue,
        aggregatorAddress,
        aggregatorDecimal,
      ] = result as [bigint, bigint, boolean, Address, Address, number];

      atomicExchangeFeeRate[currencyKey] = atomicExchangeFeeRateValue;
      exchangeFeeRate[currencyKey] = exchangeFeeRateValue;
      pureChainlinkPriceForAtomicSwapsEnabled[currencyKey] =
        pureChainlinkPriceForAtomicSwapsEnabledValue;
      atomicEquivalentForDexPricing[currencyKey] = {
        address: atomicEquivalentForDexPricingValue,
        decimals: 0,
      };
      aggregatorsAddresses[currencyKey] = aggregatorAddress;
      aggregatorDecimals[currencyKey] = aggregatorDecimal;
    });

    const atomicEquivalentForDexPricingWithoutZeros = Object.entries(
      atomicEquivalentForDexPricing,
    ).reduce<Record<string, Token>>((acc, curr) => {
      const [key, token] = curr;
      if (token.address !== NULL_ADDRESS) {
        acc[key] = token;
      }
      return acc;
    }, {});

    const tokenAddressesForCombination = Object.values(
      atomicEquivalentForDexPricingWithoutZeros,
    ).map(t => t.address);

    // This thing just to create all possible combinations of addresses skipping the order
    const poolKeyCombinations: PoolKey[] = tokenAddressesForCombination.flatMap(
      (address0, i) =>
        tokenAddressesForCombination
          .slice(i + 1)
          .map(address1 =>
            dexPriceAggregatorUniswapV3.getPoolKey(address0, address1, 0n),
          ),
    );

    const overriddenPoolAndDecimals = (
      await this.multiWrapper.tryAggregate<number | string>(
        true,
        this._buildOverriddenAndDecimalsCallData(
          poolKeyCombinations,
          dexPriceAggregatorAddress,
          atomicEquivalentForDexPricing,
        ),
        blockNumber,
      )
    ).map(d => d.returnData);

    const overriddenPools = overriddenPoolAndDecimals.slice(
      0,
      poolKeyCombinations.length,
    ) as Address[];

    const overriddenPoolForRoute = overriddenPools.reduce<
      Record<string, Address>
    >((acc, curr, i) => {
      acc[
        dexPriceAggregatorUniswapV3.identifyRouteFromPoolKey(
          poolKeyCombinations[i],
        )
      ] = curr;
      return acc;
    }, {});

    const equivalentDecimals = overriddenPoolAndDecimals.slice(
      poolKeyCombinations.length,
    ) as number[];

    Object.values(atomicEquivalentForDexPricing).forEach((t, i) => {
      t.decimals = equivalentDecimals[i];
    });

    return {
      lastUpdatedInMs: Date.now(),

      synthetixAddress,
      exchangerAddress,
      dexPriceAggregatorAddress,

      addressToKey,

      aggregatorDecimals,
      atomicTwapWindow,
      atomicExchangeFeeRate,
      exchangeFeeRate,
      pureChainlinkPriceForAtomicSwapsEnabled,
      atomicEquivalentForDexPricing,

      dexPriceAggregator: {
        weth,
        defaultPoolFee,
        uniswapV3Factory,
        overriddenPoolForRoute,
      },
      poolKeys: poolKeyCombinations.map(pk => {
        pk.fee = defaultPoolFee;
        return pk;
      }),
      aggregatorsAddresses,
      systemStatusAddress,
    };
  }

  private _buildObserveSlot0AndSuspensionsCallData(
    addressesFromPK: Address[],
  ): [
    number,
    MultiCallParams<Record<0 | 1, bigint> | Slot0 | boolean[] | boolean>[],
  ] {
    let packCounter = 0;
    let callData: MultiCallParams<
      Record<0 | 1, bigint> | Slot0 | boolean[] | boolean
    >[] = addressesFromPK
      .map(address => {
        const _callData = [
          {
            target: address,
            callData: this.combinedIface.encodeFunctionData('observe', [
              [this.onchainConfigValues!.atomicTwapWindow, 0n],
            ]),
            decodeFunction: decodeObserveTickCumulatives,
          },
          {
            target: address,
            callData: this.combinedIface.encodeFunctionData('slot0', []),
            decodeFunction: decodeUniswapV3Slot0,
          },
        ];
        packCounter = _callData.length;
        return _callData;
      })
      .flat();

    const currencyKeys = Object.values(this.onchainConfigValues!.addressToKey);
    callData = callData.concat([
      {
        target: this.onchainConfigValues!.systemStatusAddress,
        callData: this.combinedIface.encodeFunctionData('systemSuspended', []),
        decodeFunction: booleanDecode,
      },
      {
        target: this.onchainConfigValues!.systemStatusAddress,
        callData: this.combinedIface.encodeFunctionData('getSynthSuspensions', [
          currencyKeys,
        ]),
        decodeFunction: synthStatusDecoder,
      },
      {
        target: this.onchainConfigValues!.systemStatusAddress,
        callData: this.combinedIface.encodeFunctionData(
          'getSynthExchangeSuspensions',
          [currencyKeys],
        ),
        decodeFunction: synthStatusDecoder,
      },
    ]);
    return [packCounter, callData];
  }

  private _buildObservationsRoundAndOverriddenCallData(
    addressesFromPK: Address[],
    uniswapV3Slot0: Record<Address, Slot0>,
    aggregatorAddressesWithoutZeros: Record<string, Address>,
  ): [number, MultiCallParams<OracleObservation | LatestRoundData | string>[]] {
    let packCounter = 0;
    const callData = [
      ...addressesFromPK
        .map(address => {
          const _callData = [
            {
              target: address,
              callData: this.combinedIface.encodeFunctionData('observations', [
                uniswapV3Slot0[address].observationIndex,
              ]),
              decodeFunction: decodeOracleObservation,
            },
            {
              target: address,
              callData: this.combinedIface.encodeFunctionData('observations', [
                uniswapV3Slot0[address].observationCardinality !== 0n
                  ? OracleLibrary.getPrevIndex(
                      uniswapV3Slot0[address].observationIndex,
                      uniswapV3Slot0[address].observationCardinality,
                    )
                  : 0n,
              ]),
              decodeFunction: decodeOracleObservation,
            },
          ];
          packCounter = _callData.length;
          return _callData;
        })
        .flat(),
      ...Object.values(aggregatorAddressesWithoutZeros).map(address => ({
        target: address,
        callData: this.combinedIface.encodeFunctionData('latestRoundData', []),
        decodeFunction: decodeLatestRoundData,
      })),
      ...this._buildOverriddenCallData(
        this.onchainConfigValues!.poolKeys,
        this.onchainConfigValues!.dexPriceAggregatorAddress,
      ),
    ];
    return [packCounter, callData];
  }

  private _buildOneOverriddenCallData(
    dexPriceAggregatorAddress: Address,
    key: PoolKey,
  ) {
    return {
      target: dexPriceAggregatorAddress,
      callData: this.combinedIface.encodeFunctionData(
        'overriddenPoolForRoute',
        [dexPriceAggregatorUniswapV3.identifyRouteFromPoolKey(key)],
      ),
      decodeFunction: addressDecode,
    };
  }

  private _buildOverriddenCallData(
    poolKeyCombinations: PoolKey[],
    dexPriceAggregatorAddress: Address,
  ) {
    return poolKeyCombinations.map((key: PoolKey) =>
      this._buildOneOverriddenCallData(dexPriceAggregatorAddress, key),
    );
  }

  private _buildOverriddenAndDecimalsCallData(
    poolKeyCombinations: PoolKey[],
    dexPriceAggregatorAddress: Address,
    atomicEquivalentForDexPricing: Record<string, Token>,
  ) {
    return [
      ...poolKeyCombinations.map((key: PoolKey) => ({
        target: dexPriceAggregatorAddress,
        callData: this.combinedIface.encodeFunctionData(
          'overriddenPoolForRoute',
          [dexPriceAggregatorUniswapV3.identifyRouteFromPoolKey(key)],
        ),
        decodeFunction: addressDecode,
      })),
      ...Object.values(atomicEquivalentForDexPricing).map(token => ({
        target: token.address,
        callData: this.combinedIface.encodeFunctionData('decimals', []),
        decodeFunction: uint8ToNumber,
      })),
    ];
  }

  private _buildFlexibleStorageCurrencyCallData(
    synthCurrencyKeys: string[],
    exchangeRatesAddress: Address,
  ): [number, MultiCallParams<bigint | boolean | Address | number>[]] {
    let packCounter = 0;
    const callData = synthCurrencyKeys
      .map(key => {
        const result = [
          {
            target: this.config.flexibleStorage,
            callData: this.combinedIface.encodeFunctionData('getUIntValue', [
              encodeStringToBytes32(SETTING_CONTRACT_NAME),
              ethers.utils.solidityKeccak256(
                ['bytes32', 'bytes32'],
                [encodeStringToBytes32(SETTING_ATOMIC_EXCHANGE_FEE_RATE), key],
              ),
            ]),
            decodeFunction: uintDecode,
          },
          {
            target: this.config.flexibleStorage,
            callData: this.combinedIface.encodeFunctionData('getUIntValue', [
              encodeStringToBytes32(SETTING_CONTRACT_NAME),
              ethers.utils.solidityKeccak256(
                ['bytes32', 'bytes32'],
                [encodeStringToBytes32(SETTING_EXCHANGE_FEE_RATE), key],
              ),
            ]),
            decodeFunction: uintDecode,
          },
          {
            target: this.config.flexibleStorage,
            callData: this.combinedIface.encodeFunctionData('getBoolValue', [
              encodeStringToBytes32(SETTING_CONTRACT_NAME),
              ethers.utils.solidityKeccak256(
                ['bytes32', 'bytes32'],
                [
                  encodeStringToBytes32(
                    SETTING_PURE_CHAINLINK_PRICE_FOR_ATOMIC_SWAPS_ENABLED,
                  ),
                  key,
                ],
              ),
            ]),
            decodeFunction: booleanDecode,
          },
          {
            target: this.config.flexibleStorage,
            callData: this.combinedIface.encodeFunctionData('getAddressValue', [
              encodeStringToBytes32(SETTING_CONTRACT_NAME),
              ethers.utils.solidityKeccak256(
                ['bytes32', 'bytes32'],
                [
                  encodeStringToBytes32(
                    SETTING_ATOMIC_EQUIVALENT_FOR_DEX_PRICING,
                  ),
                  key,
                ],
              ),
            ]),
            decodeFunction: addressDecode,
          },
          {
            target: exchangeRatesAddress,
            callData: this.combinedIface.encodeFunctionData('aggregators', [
              key,
            ]),
            decodeFunction: addressDecode,
          },
          {
            target: exchangeRatesAddress,
            callData: this.combinedIface.encodeFunctionData(
              'currencyKeyDecimals',
              [key],
            ),
            decodeFunction: uint8ToNumber,
          },
        ];
        packCounter = result.length;
        return result;
      })
      .flat();
    return [packCounter, callData];
  }

  private _buildResolverAggregatorAndCurrencyCallData(
    targetAddress: Address,
    dexPriceAggregatorAddress: Address,
    synthsAddresses: Address[],
  ) {
    return [
      {
        target: targetAddress,
        callData: this.combinedIface.encodeFunctionData('getAddress', [
          encodeStringToBytes32(Contracts.SYNTHETIX),
        ]),
        decodeFunction: addressDecode,
      },
      {
        target: targetAddress,
        callData: this.combinedIface.encodeFunctionData('getAddress', [
          encodeStringToBytes32(Contracts.EXCHANGER),
        ]),
        decodeFunction: addressDecode,
      },
      {
        target: targetAddress,
        callData: this.combinedIface.encodeFunctionData('getAddress', [
          encodeStringToBytes32(Contracts.EXCHANGE_RATES),
        ]),
        decodeFunction: addressDecode,
      },
      {
        target: targetAddress,
        callData: this.combinedIface.encodeFunctionData('getAddress', [
          encodeStringToBytes32(Contracts.SYSTEM_STATUS),
        ]),
        decodeFunction: addressDecode,
      },
      {
        target: dexPriceAggregatorAddress,
        callData: this.combinedIface.encodeFunctionData('weth', []),
        decodeFunction: addressDecode,
      },
      {
        target: dexPriceAggregatorAddress,
        callData: this.combinedIface.encodeFunctionData('uniswapV3Factory', []),
        decodeFunction: addressDecode,
      },
      {
        target: dexPriceAggregatorAddress,
        callData: this.combinedIface.encodeFunctionData('defaultPoolFee', []),
        decodeFunction: uint24ToBigInt,
      },
      ...synthsAddresses.map(address => ({
        target: address,
        callData: this.combinedIface.encodeFunctionData('currencyKey', []),
        decodeFunction: bytes32ToString,
      })),
    ];
  }

  private _buildInitialStateCallData() {
    return [
      {
        target: this.config.readProxyAddressResolver,
        callData: this.combinedIface.encodeFunctionData('target', []),
        decodeFunction: addressDecode,
      },
      {
        target: this.config.flexibleStorage,
        callData: this.combinedIface.encodeFunctionData('getAddressValue', [
          encodeStringToBytes32(EXCHANGE_RATES_CONTRACT_NAME),
          encodeStringToBytes32(SETTING_DEX_PRICE_AGGREGATOR),
        ]),
        decodeFunction: addressDecode,
      },
      {
        target: this.config.flexibleStorage,
        callData: this.combinedIface.encodeFunctionData('getUIntValue', [
          encodeStringToBytes32(SETTING_CONTRACT_NAME),
          encodeStringToBytes32(SETTING_ATOMIC_TWAP_WINDOW),
        ]),
        decodeFunction: uintDecode,
      },
      ...this.config.synths.map(synthAddress => ({
        target: synthAddress,
        callData: this.combinedIface.encodeFunctionData('target', []),
        decodeFunction: addressDecode,
      })),
    ];
  }
}
