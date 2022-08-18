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
import { getDexKeysWithNetwork, _require } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { OnchainConfigValues, PoolKey, SynthetixData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { SynthetixConfig, Adapters } from './config';
import { Interface } from '@ethersproject/abi';
import { MultiWrapper } from '../../lib/multi-wrapper';
import {
  addressDecode,
  booleanDecode,
  bytes32ToString,
  uint24ToBigInt,
  uint8ToNumber,
  uintDecode,
} from '../../lib/decoders';
import { encodeStringToBytes32 } from './utils';
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

// There are so many ABIs, where I need only one or two functions
// So, I decided to unite them into one combined interface
import CombinedCherryPickABI from '../../abi/synthetix/CombinedCherryPick.abi.json';
import { dexPriceAggregatorUniswapV3 } from './contract-math/DexPriceAggregatorUniswapV3';

export class Synthetix extends SimpleExchange implements IDex<SynthetixData> {
  // protected eventPools: SynthetixEventPool;

  readonly hasConstantPriceLargeAmounts = false;

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

    // this.eventPools = new SynthetixEventPool(
    //   dexKey,
    //   network,
    //   dexHelper,
    //   this.logger,
    // );
  }

  async initializePricing(blockNumber: number) {
    this.onchainConfigValues = await this.getOnchainConfigValues(blockNumber);
  }

  async getOnchainConfigValues(
    blockNumber?: number,
  ): Promise<OnchainConfigValues> {
    // We do three onchain calls for one state update

    const [
      targetAddress,
      dexPriceAggregatorAddress,
      atomicTwapWindow,
      ...synthsAddresses
    ] = (
      await this.multiWrapper.tryAggregate<string | bigint>(true, [
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
      ])
    ).map(d => d.returnData);

    const [
      synthetixAddress,
      exchangerAddress,
      wethAddress,
      uniswapV3Factory,
      defaultPoolFee,
      ...synthCurrencyKeys
    ] = (
      await this.multiWrapper.tryAggregate<string | number | bigint>(true, [
        {
          target: targetAddress as string,
          callData: this.combinedIface.encodeFunctionData('getAddress', [
            encodeStringToBytes32(Contracts.SYNTHETIX),
          ]),
          decodeFunction: addressDecode,
        },
        {
          target: targetAddress as string,
          callData: this.combinedIface.encodeFunctionData('getAddress', [
            encodeStringToBytes32(Contracts.EXCHANGER),
          ]),
          decodeFunction: addressDecode,
        },
        {
          target: dexPriceAggregatorAddress as string,
          callData: this.combinedIface.encodeFunctionData('weth', []),
          decodeFunction: addressDecode,
        },
        {
          target: dexPriceAggregatorAddress as string,
          callData: this.combinedIface.encodeFunctionData(
            'uniswapV3Factory',
            [],
          ),
          decodeFunction: addressDecode,
        },
        {
          target: dexPriceAggregatorAddress as string,
          callData: this.combinedIface.encodeFunctionData('defaultPoolFee', []),
          decodeFunction: uint24ToBigInt,
        },
        ...synthsAddresses.map(address => ({
          target: address as string,
          callData: this.combinedIface.encodeFunctionData('currencyKey', []),
          decodeFunction: bytes32ToString,
        })),
      ])
    ).map(d => d.returnData);

    _require(
      synthCurrencyKeys.length === this.config.synths.length,
      `Number of currencyKeys=${synthCurrencyKeys.length} doesn't match the number of synth=${this.config.synths.length} in config`,
    );

    const addressToKey = this.config.synths.reduce<Record<Address, string>>(
      (acc, curr, i) => {
        const _tokenAddress = curr.toLowerCase();
        acc[_tokenAddress] = synthCurrencyKeys[i] as string;
        return acc;
      },
      {},
    );

    // This value updated automatically and used later to make difference between different value in array
    let packCounter = 0;
    const results = (
      await this.multiWrapper.tryAggregate<bigint | boolean | string>(
        true,
        synthCurrencyKeys
          .map(key => {
            const result = [
              {
                target: this.config.flexibleStorage,
                callData: this.combinedIface.encodeFunctionData(
                  'getUIntValue',
                  [
                    encodeStringToBytes32(SETTING_CONTRACT_NAME),
                    ethers.utils.solidityKeccak256(
                      ['bytes32', 'bytes32'],
                      [
                        encodeStringToBytes32(SETTING_ATOMIC_EXCHANGE_FEE_RATE),
                        key,
                      ],
                    ),
                  ],
                ),
                decodeFunction: uintDecode,
              },
              {
                target: this.config.flexibleStorage,
                callData: this.combinedIface.encodeFunctionData(
                  'getUIntValue',
                  [
                    encodeStringToBytes32(SETTING_CONTRACT_NAME),
                    ethers.utils.solidityKeccak256(
                      ['bytes32', 'bytes32'],
                      [encodeStringToBytes32(SETTING_EXCHANGE_FEE_RATE), key],
                    ),
                  ],
                ),
                decodeFunction: uintDecode,
              },
              {
                target: this.config.flexibleStorage,
                callData: this.combinedIface.encodeFunctionData(
                  'getBoolValue',
                  [
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
                  ],
                ),
                decodeFunction: booleanDecode,
              },
              {
                target: this.config.flexibleStorage,
                callData: this.combinedIface.encodeFunctionData(
                  'getAddressValue',
                  [
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
                  ],
                ),
                decodeFunction: addressDecode,
              },
            ];
            packCounter = result.length;
            return result;
          })
          .flat(),
      )
    ).map(d => d.returnData);

    const atomicExchangeFeeRate: Record<string, bigint> = {};
    const exchangeFeeRate: Record<string, bigint> = {};
    const pureChainlinkPriceForAtomicSwapsEnabled: Record<string, boolean> = {};
    const atomicEquivalentForDexPricing: Record<string, Token> = {};

    _.chunk(results, packCounter).map((result, i) => {
      const [
        atomicExchangeFeeRateValue,
        exchangeFeeRateValue,
        pureChainlinkPriceForAtomicSwapsEnabledValue,
        atomicEquivalentForDexPricingValue,
      ] = result;

      atomicExchangeFeeRate[synthCurrencyKeys[i] as string] =
        atomicExchangeFeeRateValue as bigint;
      exchangeFeeRate[synthCurrencyKeys[i] as string] =
        exchangeFeeRateValue as bigint;
      pureChainlinkPriceForAtomicSwapsEnabled[synthCurrencyKeys[i] as string] =
        pureChainlinkPriceForAtomicSwapsEnabledValue as boolean;
      atomicEquivalentForDexPricing[synthCurrencyKeys[i] as string] = {
        address: atomicEquivalentForDexPricingValue as Address,
        decimals: 0,
      };
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

    const poolKeyCombinations: PoolKey[] = tokenAddressesForCombination.flatMap(
      (address0, i) =>
        tokenAddressesForCombination
          .slice(i + 1)
          .map(address1 =>
            dexPriceAggregatorUniswapV3.getPoolKey(address0, address1, 0n),
          ),
    );

    const overriddenPoolAndDecimals = (
      await this.multiWrapper.tryAggregate<number | string>(true, [
        ...poolKeyCombinations.map((key: PoolKey) => ({
          target: dexPriceAggregatorAddress as string,
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
      ])
    ).map(d => d.returnData);

    const overriddenPools = overriddenPoolAndDecimals.slice(
      0,
      poolKeyCombinations.length,
    );

    const overriddenPoolForRoute = overriddenPools.reduce<
      Record<string, Address>
    >((acc, curr, i) => {
      acc[
        dexPriceAggregatorUniswapV3.identifyRouteFromPoolKey(
          poolKeyCombinations[i],
        )
      ] = curr as Address;
      return acc;
    }, {});

    const equivalentDecimals = overriddenPoolAndDecimals.slice(
      poolKeyCombinations.length,
    );

    Object.values(atomicEquivalentForDexPricing).forEach((t, i) => {
      t.decimals = equivalentDecimals[i] as number;
    });

    return {
      lastUpdatedInMs: Date.now(),

      synthetixAddress: synthetixAddress as Address,
      exchangerAddress: exchangerAddress as Address,
      dexPriceAggregatorAddress: dexPriceAggregatorAddress as Address,

      addressToKey,

      atomicTwapWindow: atomicTwapWindow as bigint,
      atomicExchangeFeeRate,
      exchangeFeeRate,
      pureChainlinkPriceForAtomicSwapsEnabled,
      atomicEquivalentForDexPricing,

      dexPriceAggregator: {
        weth: wethAddress as string,
        defaultPoolFee: defaultPoolFee as bigint,
        uniswapV3Factory: uniswapV3Factory as string,
        overriddenPoolForRoute,
      },
    };
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    // TODO: complete me!
    return [];
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SynthetixData>> {
    // TODO: complete me!
    return null;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
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

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
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

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!
    return [];
  }
}
