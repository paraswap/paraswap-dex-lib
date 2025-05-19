import _ from 'lodash';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { PartialEventSubscriber } from '../../composed-event-subscriber';
import { Lens } from '../../lens';
import VaultABI from '../../abi/quick-perps/vault.json';
import { VaultUtils } from './vault-utils';
import {
  VaultConfig,
  VaultState,
  FastPriceFeedConfig,
  PoolState,
} from './types';
import { VaultPriceFeed } from './vault-price-feed';
import { USDQ } from './usdq';
import {
  MultiCallInput,
  MultiCallOutput,
  Address,
  Logger,
  Log,
} from '../../types';
import { BlockHeader } from 'web3-eth';
import { Interface } from 'ethers';

export class Vault<State> extends PartialEventSubscriber<State, VaultState> {
  static readonly interface: Interface = new Interface(VaultABI);

  protected vaultUtils: VaultUtils<State>;

  public tokenDecimals: { [address: string]: number };
  public stableTokens: { [address: string]: boolean };
  protected tokenWeights: { [address: string]: bigint };
  public stableSwapFeeBasisPoints: bigint;
  public swapFeeBasisPoints: bigint;
  public stableTaxBasisPoints: bigint;
  public taxBasisPoints: bigint;
  public hasDynamicFees: bigint;
  protected includeAmmPrice: boolean;
  protected useSwapPricing: boolean;
  protected totalTokenWeights: bigint;

  constructor(
    public readonly vaultAddress: Address,
    protected tokenAddresses: Address[],
    config: VaultConfig,
    protected vaultPriceFeed: VaultPriceFeed<State>,
    protected usdq: USDQ<State>,
    lens: Lens<DeepReadonly<State>, DeepReadonly<VaultState>>,
    logger: Logger,
  ) {
    super([vaultAddress], lens, logger);
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

  getMinPrice(state: DeepReadonly<State>, _token: Address): bigint {
    return this.vaultPriceFeed.getPrice(
      state,
      _token,
      false,
      this.includeAmmPrice,
      this.useSwapPricing,
    );
  }

  getMaxPrice(state: DeepReadonly<State>, _token: Address): bigint {
    return this.vaultPriceFeed.getPrice(
      state,
      _token,
      true,
      this.includeAmmPrice,
      this.useSwapPricing,
    );
  }

  getFeeBasisPoints(
    state: DeepReadonly<State>,
    _token: Address,
    _usdqDelta: bigint,
    _feeBasisPoints: bigint,
    _taxBasisPoints: bigint,
    _increment: boolean,
  ): bigint {
    return this.vaultUtils.getFeeBasisPoints(
      state,
      _token,
      _usdqDelta,
      _feeBasisPoints,
      _taxBasisPoints,
      _increment,
    );
  }

  getTargetUsdqAmount(state: DeepReadonly<State>, _token: Address): bigint {
    const supply = this.usdq.getTotalSupply(state);
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

  static getConfig(
    multicallOutputs: MultiCallOutput[],
    tokenAddresses: Address[],
  ): VaultConfig {
    let i = 0;
    return {
      tokenDecimals: tokenAddresses.reduce(
        (acc: { [address: string]: number }, t: Address) => {
          acc[t] = parseInt(
            Vault.interface
              .decodeFunctionResult('tokenDecimals', multicallOutputs[i++])[0]
              .toString(),
          );
          return acc;
        },
        {},
      ),
      stableTokens: tokenAddresses.reduce(
        (acc: { [address: string]: boolean }, t: Address) => {
          acc[t] = Vault.interface.decodeFunctionResult(
            'stableTokens',
            multicallOutputs[i++],
          )[0];
          return acc;
        },
        {},
      ),
      tokenWeights: tokenAddresses.reduce(
        (acc: { [address: string]: bigint }, t: Address) => {
          acc[t] = BigInt(
            Vault.interface
              .decodeFunctionResult('tokenWeights', multicallOutputs[i++])[0]
              .toString(),
          );
          return acc;
        },
        {},
      ),
      stableSwapFeeBasisPoints: BigInt(
        Vault.interface
          .decodeFunctionResult(
            'stableSwapFeeBasisPoints',
            multicallOutputs[i++],
          )[0]
          .toString(),
      ),
      swapFeeBasisPoints: BigInt(
        Vault.interface
          .decodeFunctionResult('swapFeeBasisPoints', multicallOutputs[i++])[0]
          .toString(),
      ),
      stableTaxBasisPoints: BigInt(
        Vault.interface
          .decodeFunctionResult(
            'stableTaxBasisPoints',
            multicallOutputs[i++],
          )[0]
          .toString(),
      ),
      taxBasisPoints: BigInt(
        Vault.interface
          .decodeFunctionResult('taxBasisPoints', multicallOutputs[i++])[0]
          .toString(),
      ),
      hasDynamicFees: Vault.interface.decodeFunctionResult(
        'hasDynamicFees',
        multicallOutputs[i++],
      )[0],
      includeAmmPrice: Vault.interface.decodeFunctionResult(
        'includeAmmPrice',
        multicallOutputs[i++],
      )[0],
      useSwapPricing: Vault.interface.decodeFunctionResult(
        'useSwapPricing',
        multicallOutputs[i++],
      )[0],
      totalTokenWeights: BigInt(
        Vault.interface
          .decodeFunctionResult('totalTokenWeights', multicallOutputs[i++])[0]
          .toString(),
      ),
    };
  }

  public getGenerateStateMultiCallInputs(): MultiCallInput[] {
    return this.tokenAddresses.map((t: Address) => ({
      target: this.vaultAddress,
      callData: Vault.interface.encodeFunctionData('usdqAmounts', [t]),
    }));
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<VaultState> {
    let vaultState: VaultState = {
      usdqAmounts: {},
    };
    this.tokenAddresses.forEach(
      (t: Address, i: number) =>
        (vaultState.usdqAmounts[t] = BigInt(
          Vault.interface
            .decodeFunctionResult('usdqAmounts', multicallOutputs[i])[0]
            .toString(),
        )),
    );
    return vaultState;
  }

  public getUSDQAmount(state: DeepReadonly<State>, token: Address): bigint {
    return this.lens.get()(state).usdqAmounts[token];
  }

  public processLog(
    state: DeepReadonly<VaultState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): AsyncOrSync<VaultState | null> {
    try {
      const parsed = Vault.interface.parseLog(log);

      if (!parsed) return null;

      const _state: VaultState = _.cloneDeep(state);
      switch (parsed.name) {
        case 'IncreaseUsdqAmount': {
          const tokenAddress = parsed.args.token.toLowerCase();
          const amount = BigInt(parsed.args.amount.toString());
          if (tokenAddress in state.usdqAmounts)
            _state.usdqAmounts[tokenAddress] += amount;
          return _state;
        }
        case 'DecreaseUsdqAmount': {
          const tokenAddress = parsed.args.token.toLowerCase();
          const amount = BigInt(parsed.args.amount.toString());
          if (tokenAddress in state.usdqAmounts)
            _state.usdqAmounts[tokenAddress] -= amount;
          return _state;
        }
        default:
          return null;
      }
    } catch (e) {
      this.logger.error('Failed to parse log', e);
      return null;
    }
  }
}
