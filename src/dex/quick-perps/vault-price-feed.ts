import { Interface } from '@ethersproject/abi';
import { Address, MultiCallInput, MultiCallOutput } from '../../types';
import { VaultPriceFeedConfig } from './types';
import { FastPriceFeed } from './fast-price-feed';
import VaultPriceFeedAbi from '../../abi/quick-perps/vault-price-feed.json';
import { DeepReadonly } from 'ts-essentials';
import { Api3FeedSubscriber } from '../../lib/api3-feed';

export class VaultPriceFeed<State> {
  BASIS_POINTS_DIVISOR = 10000n;
  PRICE_PRECISION = 10n ** 30n;
  ONE_USD = this.PRICE_PRECISION;

  static interface = new Interface(VaultPriceFeedAbi);

  protected isSecondaryPriceEnabled: boolean;
  protected strictStableTokens: { [address: string]: boolean };
  protected spreadBasisPoints: { [address: string]: bigint };
  protected adjustmentBasisPoints: { [address: string]: bigint };
  protected isAdjustmentAdditive: { [address: string]: boolean };
  protected priceDecimals: { [address: string]: number };
  protected maxStrictPriceDeviation: bigint;

  constructor(
    config: VaultPriceFeedConfig,
    protected primaryPrices: { [token: string]: Api3FeedSubscriber<State> },
    protected secondaryPrice: FastPriceFeed<State>,
  ) {
    this.isSecondaryPriceEnabled = config.isSecondaryPriceEnabled;
    this.strictStableTokens = config.strictStableTokens;
    this.spreadBasisPoints = config.spreadBasisPoints;
    this.adjustmentBasisPoints = config.adjustmentBasisPoints;
    this.isAdjustmentAdditive = config.isAdjustmentAdditive;
    this.priceDecimals = config.priceDecimals;
    this.maxStrictPriceDeviation = config.maxStrictPriceDeviation;
  }

  getPrice(
    state: DeepReadonly<State>,
    _token: Address,
    _maximize: boolean,
    _includeAmmPrice: boolean,
    _useSwapPricing: boolean,
  ): bigint {
    let price = this.getPriceV1(state, _token, _maximize, _includeAmmPrice);

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

  getPriceV1(
    state: DeepReadonly<State>,
    _token: Address,
    _maximize: boolean,
    _includeAmmPrice: boolean,
  ): bigint {
    let price = this.getPrimaryPrice(state, _token, _maximize);

    if (this.isSecondaryPriceEnabled) {
      price = this.getSecondaryPrice(state, _token, price, _maximize);
    }

    if (this.strictStableTokens[_token]) {
      const delta =
        price > this.ONE_USD ? price - this.ONE_USD : this.ONE_USD - price;
      if (delta <= this.maxStrictPriceDeviation) {
        return this.ONE_USD;
      }

      // if _maximize and price is e.g. 1.02, return 1.02
      if (_maximize && price > this.ONE_USD) {
        return price;
      }

      // if !_maximize and price is e.g. 0.98, return 0.98
      if (!_maximize && price < this.ONE_USD) {
        return price;
      }

      return this.ONE_USD;
    }

    const _spreadBasisPoints = this.spreadBasisPoints[_token];

    if (_maximize) {
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

  getAmmPrice(state: DeepReadonly<State>, token: Address): bigint {
    throw new Error(
      'getAmmPrice implementation is not complete, developers should disable the dex or complete the implementation',
    );
  }

  getPrimaryPrice(
    state: DeepReadonly<State>,
    _token: Address,
    _maximize: boolean,
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
    // const roundId = priceFeed.latestRound;

    // for (let i = 0; i < this.priceSampleSpace; i++) {
    //   if (roundId <= i) {
    //     break;
    //   }

    //   if (i == 0) {
    //       const _p = priceFeed.latestAnswer();
    //       require(_p > 0, "VaultPriceFeed: invalid price");
    //       p = uint256(_p);
    //   } else {
    //       (, int256 _p, , ,) = priceFeed.getRoundData(roundId - i);
    //       require(_p > 0, "VaultPriceFeed: invalid price");
    //       p = uint256(_p);
    //   }

    //   if (price == 0n) {
    //     price = p;
    //     continue;
    //   }

    //   if (_maximize && p > price) {
    //     price = p;
    //     continue;
    //   }

    //   if (!_maximize && p < price) {
    //     price = p;
    //   }
    // }
    price = this.primaryPrices[_token].getLatestData(state);

    // require(price > 0n, "VaultPriceFeed: could not fetch price");
    if (price <= 0n) throw new Error('VaultPriceFeed: could not fetch price');
    // normalize price precision
    const _priceDecimals = this.priceDecimals[_token];
    return (price * this.PRICE_PRECISION) / BigInt(10 ** _priceDecimals);
  }

  getSecondaryPrice(
    state: DeepReadonly<State>,
    _token: Address,
    _referencePrice: bigint,
    _maximize: boolean,
  ): bigint {
    return this.secondaryPrice.getPrice(
      state,
      _token,
      _referencePrice,
      _maximize,
    );
  }

  static getConfigMulticallInputs(
    vaultPriceFeedAddress: Address,
    tokenAddresses: Address[],
  ): MultiCallInput[] {
    return [
      {
        target: vaultPriceFeedAddress,
        callData: VaultPriceFeed.interface.encodeFunctionData(
          'isSecondaryPriceEnabled',
        ),
      },
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: VaultPriceFeed.interface.encodeFunctionData(
          'strictStableTokens',
          [t],
        ),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: VaultPriceFeed.interface.encodeFunctionData(
          'spreadBasisPoints',
          [t],
        ),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: VaultPriceFeed.interface.encodeFunctionData(
          'isAdjustmentAdditive',
          [t],
        ),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: VaultPriceFeed.interface.encodeFunctionData(
          'adjustmentBasisPoints',
          [t],
        ),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultPriceFeedAddress,
        callData: VaultPriceFeed.interface.encodeFunctionData('priceDecimals', [
          t,
        ]),
      })),
      {
        target: vaultPriceFeedAddress,
        callData: VaultPriceFeed.interface.encodeFunctionData(
          'maxStrictPriceDeviation',
        ),
      },
    ];
  }

  static getConfig(
    multicallOutputs: MultiCallOutput[],
    tokenAddress: Address[],
  ): VaultPriceFeedConfig {
    let i = 0;
    return {
      isSecondaryPriceEnabled: VaultPriceFeed.interface.decodeFunctionResult(
        'isSecondaryPriceEnabled',
        multicallOutputs[i++],
      )[0],
      strictStableTokens: tokenAddress.reduce(
        (acc: { [address: string]: boolean }, t: Address) => {
          acc[t] = VaultPriceFeed.interface.decodeFunctionResult(
            'strictStableTokens',
            multicallOutputs[i++],
          )[0];
          return acc;
        },
        {},
      ),
      spreadBasisPoints: tokenAddress.reduce(
        (acc: { [address: string]: bigint }, t: Address) => {
          acc[t] = BigInt(
            VaultPriceFeed.interface
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
        (acc: { [address: string]: boolean }, t: Address) => {
          acc[t] = VaultPriceFeed.interface.decodeFunctionResult(
            'isAdjustmentAdditive',
            multicallOutputs[i++],
          )[0];
          return acc;
        },
        {},
      ),
      adjustmentBasisPoints: tokenAddress.reduce(
        (acc: { [address: string]: bigint }, t: Address) => {
          acc[t] = BigInt(
            VaultPriceFeed.interface
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
        (acc: { [address: string]: number }, t: Address) => {
          acc[t] = parseInt(
            VaultPriceFeed.interface
              .decodeFunctionResult('priceDecimals', multicallOutputs[i++])[0]
              .toString(),
          );
          return acc;
        },
        {},
      ),
      maxStrictPriceDeviation: BigInt(
        VaultPriceFeed.interface
          .decodeFunctionResult(
            'maxStrictPriceDeviation',
            multicallOutputs[i++],
          )[0]
          .toString(),
      ),
    };
  }
}
