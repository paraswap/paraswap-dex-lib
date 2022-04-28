import { Interface } from '@ethersproject/abi';
import { Address, MultiCallInput, MultiCallOutput } from '../../types';
import { PoolState, VaultPriceFeedConfig } from './types';
import { FastPriceFeed } from './fast-price-feed';
import VaultPriceFeedAbi from '../../abi/gmx/vault-price-feed.json';

export class VaultPriceFeed<State> {
  BASIS_POINTS_DIVISOR = 10000n;
  PRICE_PRECISION = 10n ** 30n;
  ONE_USD = this.PRICE_PRECISION;

  static interface = new Interface(VaultPriceFeedAbi);

  protected isAmmEnabled: boolean;
  protected isSecondaryPriceEnabled: boolean;
  protected strictStableTokens: { [address: string]: boolean };
  protected spreadBasisPoints: { [address: string]: bigint };
  protected adjustmentBasisPoints: { [address: string]: bigint };
  protected isAdjustmentAdditive: { [address: string]: bigint };
  protected priceDecimals: { [address: string]: number };
  protected maxStrictPriceDeviation: bigint;
  protected useV2Pricing: boolean;
  protected priceSampleSpace: number;

  constructor(
    config: VaultPriceFeedConfig,
    protected secondaryPrice: FastPriceFeed<State>,
  ) {
    this.isAmmEnabled = config.isAmmEnabled;
    this.isSecondaryPriceEnabled = config.isSecondaryPriceEnabled;
    this.strictStableTokens = config.strictStableTokens;
    this.spreadBasisPoints = config.spreadBasisPoints;
    this.adjustmentBasisPoints = config.adjustmentBasisPoints;
    this.isAdjustmentAdditive = config.isAdjustmentAdditive;
    this.priceDecimals = config.priceDecimals;
    this.maxStrictPriceDeviation = config.maxStrictPriceDeviation;
    this.useV2Pricing = config.useV2Pricing;
    this.priceSampleSpace = config.priceSampleSpace;
  }

  getPrice(
    state: PoolState,
    _token: Address,
    _maximise: boolean,
    _includeAmmPrice: boolean,
    _useSwapPricing: boolean,
  ): bigint {
    let price = this.useV2Pricing
      ? this.getPriceV2(state, _token, _maximise, _includeAmmPrice)
      : this.getPriceV1(state, _token, _maximise, _includeAmmPrice);

    const adjustmentBps = this.adjustmentBasisPoints[_token];
    if (adjustmentBps > 0n) {
      const isAdditive = this.isAdjustmentAdditive[_token];
      if (isAdditive) {
        price =
          (price * (this.BASIS_POINTS_DIVISOR + adjustmentBps)) /
          this.BASIS_POINTS_DIVISOR;
      } else {
        price =
          (price * (this.BASIS_POINTS_DIVISOR - adjustmentBps)) /
          this.BASIS_POINTS_DIVISOR;
      }
    }

    return price;
  }

  getPriceV2(
    state: PoolState,
    _token: Address,
    _maximise: boolean,
    _includeAmmPrice: boolean,
  ): bigint {
    throw new Error(
      'getPriceV2 implementation is not complete, devs should disable the dex or complete the implementation',
    );
  }

  getPriceV1(
    state: PoolState,
    _token: Address,
    _maximise: boolean,
    _includeAmmPrice: boolean,
  ): bigint {
    let price = this.getPrimaryPrice(state, _token, _maximise);

    if (_includeAmmPrice && this.isAmmEnabled) {
      const ammPrice = this.getAmmPrice(state, _token);
      if (ammPrice > 0n) {
        if (_maximise && ammPrice > price) {
          price = ammPrice;
        }
        if (!_maximise && ammPrice < price) {
          price = ammPrice;
        }
      }
    }

    if (this.isSecondaryPriceEnabled) {
      price = this.getSecondaryPrice(state, _token, price, _maximise);
    }

    if (this.strictStableTokens[_token]) {
      const delta =
        price > this.ONE_USD ? price - this.ONE_USD : this.ONE_USD - price;
      if (delta <= this.maxStrictPriceDeviation) {
        return this.ONE_USD;
      }

      // if _maximise and price is e.g. 1.02, return 1.02
      if (_maximise && price > this.ONE_USD) {
        return price;
      }

      // if !_maximise and price is e.g. 0.98, return 0.98
      if (!_maximise && price < this.ONE_USD) {
        return price;
      }

      return this.ONE_USD;
    }

    const _spreadBasisPoints = this.spreadBasisPoints[_token];

    if (_maximise) {
      return (
        (price * (this.BASIS_POINTS_DIVISOR + _spreadBasisPoints)) /
        this.BASIS_POINTS_DIVISOR
      );
    }

    return (
      (price * (this.BASIS_POINTS_DIVISOR - _spreadBasisPoints)) /
      this.BASIS_POINTS_DIVISOR
    );
  }

  getAmmPrice(state: PoolState, token: Address): bigint {
    throw new Error(
      'getAmmPrice implementation is not complete, devs should disable the dex or complete the implementation',
    );
  }

  getPrimaryPrice(
    state: PoolState,
    _token: Address,
    _maximise: boolean,
  ): bigint {
    // const priceFeedAddress = this.priceFeeds[_token];
    // require(priceFeedAddress != address(0), "VaultPriceFeed: invalid price feed");

    // if (chainlinkFlags != address(0)) {
    //   bool isRaised = IChainlinkFlags(chainlinkFlags).getFlag(FLAG_ARBITRUM_SEQ_OFFLINE);
    //   if (isRaised) {
    //           // If flag is raised we shouldn't perform any critical operations
    //       revert("Chainlink feeds are not being updated");
    //   }
    // }

    // IPriceFeed priceFeed = IPriceFeed(priceFeedAddress);
    let price = 0n;
    const roundId = state.primaryPrices[_token].latestRound;

    for (let i = 0; i < this.priceSampleSpace; i++) {
      if (roundId <= i) {
        break;
      }
      let p = state.primaryPrices[_token].roundData[roundId - i];

      // if (i == 0) {
      //     const _p = priceFeed.latestAnswer();
      //     require(_p > 0, "VaultPriceFeed: invalid price");
      //     p = uint256(_p);
      // } else {
      //     (, int256 _p, , ,) = priceFeed.getRoundData(roundId - i);
      //     require(_p > 0, "VaultPriceFeed: invalid price");
      //     p = uint256(_p);
      // }

      if (price == 0n) {
        price = p;
        continue;
      }

      if (_maximise && p > price) {
        price = p;
        continue;
      }

      if (!_maximise && p < price) {
        price = p;
      }
    }

    // require(price > 0n, "VaultPriceFeed: could not fetch price");
    if (price <= 0n) throw new Error('VaultPriceFeed: could not fetch price');
    // normalise price precision
    const _priceDecimals = this.priceDecimals[_token];
    return (price * this.PRICE_PRECISION) / BigInt(10 ** _priceDecimals);
  }

  getSecondaryPrice(
    poolState: PoolState,
    _token: Address,
    _referencePrice: bigint,
    _maximise: boolean,
  ): bigint {
    return this.secondaryPrice.getPrice(
      poolState,
      _token,
      _referencePrice,
      _maximise,
    );
  }

  static getConfigMulticallInputs(
    vaultPriceFeedAddress: Address,
    tokenAddresses: Address[],
  ): MultiCallInput[] {
    return [
      {
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData('isAmmEnabled'),
      },
      {
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData(
          'isSecondaryPriceEnabled',
        ),
      },
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData(
          'strictStableTokens',
          [t],
        ),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData(
          'spreadBasisPoints',
          [t],
        ),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData(
          'isAdjustmentAdditive',
          [t],
        ),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData(
          'adjustmentBasisPoints',
          [t],
        ),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData('priceDecimals', [
          t,
        ]),
      })),
      {
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData(
          'maxStrictPriceDeviation',
        ),
      },
      {
        target: vaultPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData('useV2Pricing'),
      },
      {
        target: vaultPriceFeedAddress,
        callData:
          FastPriceFeed.interface.encodeFunctionData('priceSampleSpace'),
      },
    ];
  }

  static getConfig(
    multicallOutputs: MultiCallOutput[],
    tokenAddress: Address[],
  ): VaultPriceFeedConfig {
    let i = 0;
    return {
      isAmmEnabled: FastPriceFeed.interface.decodeFunctionResult(
        'isAmmEnabled',
        multicallOutputs[i++],
      )[0],
      isSecondaryPriceEnabled: FastPriceFeed.interface.decodeFunctionResult(
        'isSecondaryPriceEnabled',
        multicallOutputs[i++],
      )[0],
      strictStableTokens: tokenAddress.reduce(
        (acc: { [address: Address]: boolean }, t: Address) => {
          acc[t] = FastPriceFeed.interface.decodeFunctionResult(
            'strictStableTokens',
            multicallOutputs[i++],
          )[0];
          return acc;
        },
        {},
      ),
      spreadBasisPoints: tokenAddress.reduce(
        (acc: { [address: Address]: bigint }, t: Address) => {
          acc[t] = BigInt(
            FastPriceFeed.interface
              .decodeFunctionResult(
                'spreadBasisPoints',
                multicallOutputs[i++],
              )[0]
              .toString(),
          );
          return acc;
        },
        {},
      ),
      isAdjustmentAdditive: tokenAddress.reduce(
        (acc: { [address: Address]: bigint }, t: Address) => {
          acc[t] = BigInt(
            FastPriceFeed.interface
              .decodeFunctionResult(
                'isAdjustmentAdditive',
                multicallOutputs[i++],
              )[0]
              .toString(),
          );
          return acc;
        },
        {},
      ),
      adjustmentBasisPoints: tokenAddress.reduce(
        (acc: { [address: Address]: bigint }, t: Address) => {
          acc[t] = BigInt(
            FastPriceFeed.interface
              .decodeFunctionResult(
                'adjustmentBasisPoints',
                multicallOutputs[i++],
              )[0]
              .toString(),
          );
          return acc;
        },
        {},
      ),
      priceDecimals: tokenAddress.reduce(
        (acc: { [address: Address]: bigint }, t: Address) => {
          acc[t] = BigInt(
            FastPriceFeed.interface
              .decodeFunctionResult('priceDecimals', multicallOutputs[i++])[0]
              .toString(),
          );
          return acc;
        },
        {},
      ),
      maxStrictPriceDeviation: BigInt(
        FastPriceFeed.interface
          .decodeFunctionResult(
            'maxStrictPriceDeviation',
            multicallOutputs[i++],
          )[0]
          .toString(),
      ),
      useV2Pricing: FastPriceFeed.interface.decodeFunctionResult(
        'useV2Pricing',
        multicallOutputs[i++],
      )[0],
      priceSampleSpace: parseInt(
        FastPriceFeed.interface
          .decodeFunctionResult('priceSampleSpace', multicallOutputs[i++])[0]
          .toString(),
      ),
    };
  }
}
