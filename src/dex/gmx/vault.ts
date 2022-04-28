import { Interface } from '@ethersproject/abi';
import { PartialEventSubscriber } from '../../composed-event-subscriber';
import { Lens } from '../../lens';
import VaultABI from '../../abi/gmx/vault.json';
import { VaultUtils } from './vault-utils';
import { VaultConfig, VaultState } from './types';
import { VaultPriceFeed } from './vault-price-feed';
import { MultiCallInput, MultiCallOutput, Address } from '../../types';

export class Vault<State> {
  static readonly interface: Interface = new Interface(VaultABI);

  protected vaultUtils: VaultUtils;

  protected tokenDecimals: { [address: string]: number };
  protected stableTokens: { [address: string]: boolean };
  protected tokenWeights: { [address: string]: bigint };
  protected stableSwapFeeBasisPoints: bigint;
  protected swapFeeBasisPoints: bigint;
  protected stableTaxBasisPoints: bigint;
  protected taxBasisPoints: bigint;
  protected hasDynamicFees: bigint;
  protected includeAmmPrice: boolean;
  protected useSwapPricing: boolean;
  protected totalTokenWeights: bigint;

  constructor(
    config: VaultConfig,
    protected vaultPriceFeed: VaultPriceFeed<State>,
  ) {
    this.vaultUtils = new VaultUtils(this);
    this.tokenDecimals = config.tokenDecimals;
    this.stableTokens = config.stableTokens;
    this.tokenWeights = config.tokenWeights;
    this.stableSwapFeeBasisPoints = config.stableSwapFeeBasisPoints;
    this.swapFeeBasisPoints = config.swapFeeBasisPoints;
    this.stableTaxBasisPoints = config.stableTaxBasisPoints;
    this.taxBasisPoints = config.taxBasisPoints;
    this.hasDynamicFees = config.hasDynamicFees;
    this.includeAmmPrice = config.includeAmmPrice;
    this.useSwapPricing = config.useSwapPricing;
    this.totalTokenWeights = config.totalTokenWeights;
  }

  getMinPrice(state: VaultState, _token: Address): bigint {
    return this.vaultPriceFeed.getPrice(
      state,
      _token,
      false,
      this.includeAmmPrice,
      this.useSwapPricing,
    );
  }

  getMaxPrice(state: VaultState, _token: Address): bigint {
    return this.vaultPriceFeed.getPrice(
      state,
      _token,
      true,
      this.includeAmmPrice,
      this.useSwapPricing,
    );
  }

  getFeeBasisPoints(
    state: VaultState,
    _token: Address,
    _usdgDelta: bigint,
    _feeBasisPoints: bigint,
    _taxBasisPoints: bigint,
    _increment: boolean,
  ): bigint {
    return this.vaultUtils.getFeeBasisPoints(
      state,
      _token,
      _usdgDelta,
      _feeBasisPoints,
      _taxBasisPoints,
      _increment,
    );
  }

  getTargetUsdgAmount(state: VaultState, _token: Address): bigint {
    const supply = state.usdgTotalSupply;
    if (supply == 0n) {
      return 0n;
    }
    const weight = this.tokenWeights[_token];
    return (weight * supply) / this.totalTokenWeights;
  }

  static getConfigMulticallInputs(
    vaultAddress: Address,
    tokenAddresses: Address[],
  ): MultiCallInput[] {
    return [
      ...tokenAddresses.map(t => ({
        target: vaultAddress,
        callData: Vault.interface.encodeFunctionData('tokenDecimals', [t]),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultAddress,
        callData: Vault.interface.encodeFunctionData('stableTokens', [t]),
      })),
      ...tokenAddresses.map(t => ({
        target: vaultAddress,
        callData: Vault.interface.encodeFunctionData('tokenWeights', [t]),
      })),
      ...[
        'stableSwapFeeBasisPoints',
        'swapFeeBasisPoints',
        'stableTaxBasisPoints',
        'taxBasisPoints',
        'hasDynamicFees',
        'includeAmmPrice',
        'useSwapPricing',
        'totalTokenWeights',
      ].map(fn => ({
        target: vaultAddress,
        callData: Vault.interface.encodeFunctionData(fn),
      })),
    ];
  }

  static getConfig(multicallOutputs: MultiCallOutput[]): FastPriceFeedConfig {
    throw new Error('fix me');
  }
}
