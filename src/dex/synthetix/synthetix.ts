import _ from 'lodash';
import { ethers } from 'ethers';
import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network, NULL_ADDRESS } from '../../constants';
import { getBigIntPow, getDexKeysWithNetwork, _require } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  LatestRoundData,
  OnchainConfigValues,
  OracleObservation,
  PoolKey,
  PoolState,
  Slot0,
  SynthetixData,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { SynthetixConfig, Adapters } from './config';
import { Interface } from '@ethersproject/abi';
import { MultiCallParams, MultiWrapper } from '../../lib/multi-wrapper';
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
  SYNTHETIX_GAS_COST,
} from './constants';

// There are so many ABIs, where I need only one or two functions
// So, I decided to unite them into one combined interface
import CombinedCherryPickABI from '../../abi/synthetix/CombinedCherryPick.abi.json';
import { dexPriceAggregatorUniswapV3 } from './contract-math/DexPriceAggregatorUniswapV3';
import { OracleLibrary } from './contract-math/OracleLibrary';
import { synthetixMath } from './contract-math/synthetix-math';

export class Synthetix extends SimpleExchange implements IDex<SynthetixData> {
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  // updatedAt may be blockNumber or timestamp
  fullState?: { updatedAt: number; values: PoolState };

  onchainConfigValues?: OnchainConfigValues;

  readonly combinedIface: Interface;

  readonly multiWrapper: MultiWrapper;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SynthetixConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected config = SynthetixConfig[dexKey][network],
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.combinedIface = new Interface(CombinedCherryPickABI);
    this.multiWrapper = new MultiWrapper(
      this.dexHelper.multiContract,
      this.logger,
    );
  }

  async initializePricing(blockNumber: number) {
    this.onchainConfigValues = await this.getOnchainConfigValues(blockNumber);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolIdentifier(src: Address, dest: Address) {
    return `${this.dexKey}_${src}_${dest}`.toLowerCase();
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) return [];

    const _srcAddress = this.dexHelper.config
      .wrapETH(srcToken)
      .address.toLowerCase();
    const _destAddress = this.dexHelper.config
      .wrapETH(destToken)
      .address.toLowerCase();

    if (_srcAddress === _destAddress) return [];

    if (
      this.onchainConfigValues?.addressToKey[_srcAddress] !== undefined &&
      this.onchainConfigValues?.addressToKey[_destAddress] !== undefined
    ) {
      return [this.getPoolIdentifier(_srcAddress, _destAddress)];
    }

    return [];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SynthetixData>> {
    if (this.onchainConfigValues === undefined) {
      this.logger.error(
        `${this.dexKey} is not initialized, but received pricing request`,
      );
      return null;
    }

    try {
      const _srcToken = this.dexHelper.config.wrapETH(srcToken);
      const _destToken = this.dexHelper.config.wrapETH(destToken);

      const _srcAddress = _srcToken.address.toLowerCase();
      const _destAddress = _destToken.address.toLowerCase();

      if (_srcAddress === _destAddress) return null;

      if (
        this.onchainConfigValues.addressToKey[_srcAddress] === undefined ||
        this.onchainConfigValues.addressToKey[_destAddress] === undefined
      )
        return null;

      const currentIdentifier = this.getPoolIdentifier(
        _srcAddress,
        _destAddress,
      );

      // If we received limitPools, but there is not currentIdentifier, we should return null
      // because we don't have that pool to fulfill the request
      if (limitPools !== undefined && !limitPools.includes(currentIdentifier)) {
        return null;
      }

      const unitVolume = getBigIntPow(_srcToken.decimals);

      const _amounts = [unitVolume, ...amounts.slice(1)];

      let state = this._getState(blockNumber);

      if (!state) {
        state = await this._getOnchainState(blockNumber);
      }

      const prices = _amounts.map(amount =>
        synthetixMath.getAmountsForAtomicExchange(
          state!,
          amount,
          this.onchainConfigValues!.addressToKey[_srcAddress],
          this.onchainConfigValues!.addressToKey[_destAddress],
        ),
      );

      return [
        {
          unit: prices[0],
          prices: [0n, ...prices.slice(1)],
          data: {
            exchange: this.onchainConfigValues.synthetixAddress,
          },
          poolIdentifier: currentIdentifier,
          exchange: this.dexKey,
          gasCost: SYNTHETIX_GAS_COST,
          poolAddresses: [this.onchainConfigValues.synthetixAddress],
        },
      ];
    } catch (e) {
      this.logger.error(
        `${this.dexKey} error: getPricesVolume ${
          srcToken.symbol || srcToken.address
        }, ${destToken.symbol || destToken.address}, ${side}: `,
        e,
      );
      return null;
    }
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SynthetixData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SynthetixData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the transaction arguments
    const swapData = '';

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  async updatePoolState(): Promise<void> {
    if (this.onchainConfigValues === undefined) {
      await this.initializePricing(
        await this.dexHelper.web3Provider.eth.getBlockNumber(),
      );
    }
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!
    return [];
  }

  private _getState(validForTime?: number): PoolState | undefined {
    if (
      validForTime === undefined ||
      (this.fullState && this.fullState.updatedAt < validForTime)
    ) {
      return this.fullState?.values;
    }
    return undefined;
  }

  private async _getOnchainState(blockNumber?: number): Promise<PoolState> {
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

    const [packCounter, observeAndSlot0CallData] =
      this._buildObserveAndSlot0CallData(addressesFromPK);
    const slot0AndTickCumulatives = (
      await this.multiWrapper.tryAggregate<Record<0 | 1, bigint> | Slot0>(
        true,
        observeAndSlot0CallData,
        blockNumber,
      )
    ).map(d => d.returnData) as Record<0 | 1, bigint>[];

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

    const [_packCounter, observationsAndRoundCallData] =
      this._buildObservationsAndRoundCallData(
        addressesFromPK,
        uniswapV3Slot0,
        aggregatorAddressesWithoutZeros,
      );

    const [block, observationsAndLatestRoundData] = await Promise.all([
      this.dexHelper.web3Provider.eth.getBlock(blockNumber || 'latest'),
      this.multiWrapper.tryAggregate<OracleObservation | LatestRoundData>(
        true,
        observationsAndRoundCallData,
        blockNumber,
      ),
    ]);

    const observations = observationsAndLatestRoundData
      .slice(0, addressesFromPK.length * packCounter)
      .map(e => e.returnData) as OracleObservation[];

    const latestRoundDatas = observationsAndLatestRoundData
      .slice(addressesFromPK.length * packCounter)
      .map(e => e.returnData) as LatestRoundData[];

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

    const newState = {
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
        overriddenPoolForRoute:
          this.onchainConfigValues.dexPriceAggregator.overriddenPoolForRoute,
        uniswapV3Slot0,
        uniswapV3Observations,
        tickCumulatives,
      },
      blockTimestamp: BigInt(block.timestamp),
      aggregators,
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
      await this.multiWrapper.tryAggregate<bigint | boolean | string>(
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

    _.chunk(results, packCounter).map((result, i) => {
      const currencyKey = synthCurrencyKeys[i];
      const [
        atomicExchangeFeeRateValue,
        exchangeFeeRateValue,
        pureChainlinkPriceForAtomicSwapsEnabledValue,
        atomicEquivalentForDexPricingValue,
        aggregatorAddress,
      ] = result as [bigint, bigint, boolean, Address, Address];

      atomicExchangeFeeRate[currencyKey] = atomicExchangeFeeRateValue;
      exchangeFeeRate[currencyKey] = exchangeFeeRateValue;
      pureChainlinkPriceForAtomicSwapsEnabled[currencyKey] =
        pureChainlinkPriceForAtomicSwapsEnabledValue;
      atomicEquivalentForDexPricing[currencyKey] = {
        address: atomicEquivalentForDexPricingValue,
        decimals: 0,
      };
      aggregatorsAddresses[currencyKey] = aggregatorAddress;
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
    };
  }

  private _buildObserveAndSlot0CallData(
    addressesFromPK: Address[],
  ): [number, MultiCallParams<Record<0 | 1, bigint> | Slot0>[]] {
    let packCounter = 0;
    const callData = addressesFromPK
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
    return [packCounter, callData];
  }

  private _buildObservationsAndRoundCallData(
    addressesFromPK: Address[],
    uniswapV3Slot0: Record<Address, Slot0>,
    aggregatorAddressesWithoutZeros: Record<string, Address>,
  ): [number, MultiCallParams<OracleObservation | LatestRoundData>[]] {
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
    ];
    return [packCounter, callData];
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
  ): [number, MultiCallParams<bigint | boolean | Address>[]] {
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
