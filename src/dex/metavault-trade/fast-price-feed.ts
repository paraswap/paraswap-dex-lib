import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { PartialEventSubscriber } from '../../composed-event-subscriber';
import {
  Address,
  MultiCallInput,
  MultiCallOutput,
  Logger,
  Log,
  BlockHeader,
} from '../../types';
import { FastPriceFeedConfig, FastPriceFeedState } from './types';
import FastPriceFeedAbi from '../../abi/metavault-trade/fast-price-feed.json';
import FastPriceEventsAbi from '../../abi/metavault-trade/fast-price-events.json';
import { Lens } from '../../lens';

export class FastPriceFeed<State> extends PartialEventSubscriber<
  State,
  FastPriceFeedState
> {
  static readonly interface = new Interface(FastPriceFeedAbi);
  static readonly fastPriceEventsInterface = new Interface(FastPriceEventsAbi);

  BASIS_POINTS_DIVISOR = 10000n;
  protected priceDuration: number;
  protected maxDeviationBasisPoints: bigint;
  protected favorFastPrice: boolean;
  protected volBasisPoints: bigint;

  constructor(
    private fastPriceFeedAddress: Address,
    private fastPriceEventsAddress: Address,
    private tokenAddresses: Address[],
    config: FastPriceFeedConfig,
    lens: Lens<DeepReadonly<State>, DeepReadonly<FastPriceFeedState>>,
    logger: Logger,
  ) {
    super([fastPriceEventsAddress], lens, logger);
    this.priceDuration = config.priceDuration;
    this.maxDeviationBasisPoints = config.maxDeviationBasisPoints;
    this.favorFastPrice = config.favorFastPrice;
    this.volBasisPoints = config.volBasisPoints;
  }

  public processLog(
    state: DeepReadonly<FastPriceFeedState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<FastPriceFeedState> | null {
    try {
      const parsed = FastPriceFeed.fastPriceEventsInterface.parseLog(log);
      switch (parsed.name) {
        case 'PriceUpdate': {
          const _state: FastPriceFeedState = _.cloneDeep(state);
          _state.lastUpdatedAt =
            typeof blockHeader.timestamp === 'string'
              ? parseInt(blockHeader.timestamp)
              : blockHeader.timestamp;
          const tokenAddress = parsed.args.token.toLowerCase();
          if (tokenAddress in state.prices)
            _state.prices[tokenAddress] = BigInt(parsed.args.price.toString());
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

  getPrice(
    _state: DeepReadonly<State>,
    _token: Address,
    _refPrice: bigint,
    _maximise: boolean,
  ) {
    const state = this.lens.get()(_state);

    const timestamp = Math.floor(Date.now() / 1000);

    if (timestamp > state.lastUpdatedAt + this.priceDuration) {
      return _refPrice;
    }

    const fastPrice = state.prices[_token];
    if (fastPrice == 0n) {
      return _refPrice;
    }

    const maxPrice =
      (_refPrice * (this.BASIS_POINTS_DIVISOR + this.maxDeviationBasisPoints)) /
      this.BASIS_POINTS_DIVISOR;
    const minPrice =
      (_refPrice * (this.BASIS_POINTS_DIVISOR - this.maxDeviationBasisPoints)) /
      this.BASIS_POINTS_DIVISOR;

    if (this.favorFastPrice) {
      if (fastPrice >= minPrice && fastPrice <= maxPrice) {
        if (_maximise) {
          if (_refPrice > fastPrice) {
            const volPrice =
              (fastPrice * (this.BASIS_POINTS_DIVISOR + this.volBasisPoints)) /
              this.BASIS_POINTS_DIVISOR;
            // the volPrice should not be more than _refPrice
            return volPrice > _refPrice ? _refPrice : volPrice;
          }
          return fastPrice;
        }

        if (_refPrice < fastPrice) {
          const volPrice =
            (fastPrice * (this.BASIS_POINTS_DIVISOR - this.volBasisPoints)) /
            this.BASIS_POINTS_DIVISOR;
          // the volPrice should not be less than _refPrice
          return volPrice < _refPrice ? _refPrice : volPrice;
        }

        return fastPrice;
      }
    }

    if (_maximise) {
      if (_refPrice > fastPrice) {
        return _refPrice;
      }
      return fastPrice > maxPrice ? maxPrice : fastPrice;
    }

    if (_refPrice < fastPrice) {
      return _refPrice;
    }
    return fastPrice < minPrice ? minPrice : fastPrice;
  }

  static getConfigMulticallInputs(
    fastPriceFeedAddress: Address,
  ): MultiCallInput[] {
    return [
      {
        target: fastPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData('priceDuration'),
      },
      {
        target: fastPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData(
          'maxDeviationBasisPoints',
        ),
      },
      {
        target: fastPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData('favorFastPrice'),
      },
      {
        target: fastPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData('volBasisPoints'),
      },
    ];
  }

  static getConfig(multicallOutputs: MultiCallOutput[]): FastPriceFeedConfig {
    return {
      priceDuration: parseInt(
        FastPriceFeed.interface
          .decodeFunctionResult('priceDuration', multicallOutputs[0])[0]
          .toString(),
      ),
      maxDeviationBasisPoints: BigInt(
        FastPriceFeed.interface
          .decodeFunctionResult(
            'maxDeviationBasisPoints',
            multicallOutputs[1],
          )[0]
          .toString(),
      ),
      favorFastPrice: Boolean(
        FastPriceFeed.interface
          .decodeFunctionResult('favorFastPrice', multicallOutputs[2])[0]
          .toString(),
      ),
      volBasisPoints: BigInt(
        FastPriceFeed.interface
          .decodeFunctionResult('volBasisPoints', multicallOutputs[2])[0]
          .toString(),
      ),
    };
  }

  public getGenerateStateMultiCallInputs(): MultiCallInput[] {
    const pricesEntries = this.tokenAddresses.map((t: Address) => ({
      target: this.fastPriceFeedAddress,
      callData: FastPriceFeed.interface.encodeFunctionData('prices', [t]),
    }));
    return [
      ...pricesEntries,
      {
        target: this.fastPriceFeedAddress,
        callData: FastPriceFeed.interface.encodeFunctionData('lastUpdatedAt'),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<FastPriceFeedState> {
    let fastPriceFeedState: FastPriceFeedState = {
      prices: {},
      lastUpdatedAt: 0,
    };
    this.tokenAddresses.forEach(
      (t: Address, i: number) =>
        (fastPriceFeedState.prices[t] = BigInt(
          FastPriceFeed.interface
            .decodeFunctionResult('prices', multicallOutputs[i])[0]
            .toString(),
        )),
    );
    fastPriceFeedState.lastUpdatedAt = parseInt(
      FastPriceFeed.interface
        .decodeFunctionResult(
          'lastUpdatedAt',
          multicallOutputs[this.tokenAddresses.length],
        )[0]
        .toString(),
    );
    return fastPriceFeedState;
  }
}
