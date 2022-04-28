import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';

export class GMXEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  PRICE_PRECISION = 10n ** 30n;
  USDG_DECIMALS = 18;
  BASIS_POINTS_DIVISOR = 10000n;

  constructor(
    protected parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    // TODO: add any additional params required for event subscriber
  ) {
    super(parentName, logger);

    // TODO: make logDecoder decode logs that
    // this.logDecoder = (log: Log) => this.interface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
    ];

    // Add handlers
    // this.handlers['myEvent'] = this.handleMyEvent.bind(this);
  }

  /**
   * The function is called everytime any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
      return state;
    } catch (e) {
      this.logger.error(
        `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
        e,
      );
      return null;
    }
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenrate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subsriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    // TODO: complete me!
    // Chainlink price (getPrimaryPrice)
    // FastPriceFeed prices for all the tokens (tracked by FastPriceEvents)
    // usdgAmounts for all the tokens (tracked by IncreaseUsdgAmount, DecreaseUsdgAmount)
    // usdg total supply tracked by (mint and burn ERC20 events)
    throw new Error('fix this');
  }

  async setupFixedState(blockNumber: number) {
    // vault token addresses
    // vault token decimals
    // vault stable tokens
    // vault stableSwapFeeBasisPoints and swapFeeBasisPoints
    // vault stableTaxBasisPoints and taxBasisPoints
    // vault hasDynamicFees
    // vault tokenWeights for each token
    // vaultPriceFeed isAMMEnabled (should throw error if it is)
    // vaultPriceFeed isSecondaryPriceEnabled
    // vaultPriceFeed strictStableTokens
    // vaultPriceFeed maxStrictPriceDeviation
    // vaultPriceFeed spreadBasisPoints for each token
    // FastPriceFeed priceDuration
    // FastPriceFeed maxDeviationBasisPoints
    // FastPriceFeed favorFastPrice()
    // FastPriceFeed volBasisPoints
    // FastPriceFeed priceSampleSpace
  }

  async getStateOrGenerate(blockNumber: number): Promise<Readonly<PoolState>> {
    const evenState = this.getState(blockNumber);
    if (evenState) return evenState;
    const onChainState = await this.generateState(blockNumber);
    this.setState(onChainState, blockNumber);
    return onChainState;
  }

  // Reference to the original implementation
  // https://github.com/gmx-io/gmx-contracts/blob/master/contracts/peripherals/Reader.sol#L71
  async getAmountOut(
    _tokenIn: Address,
    _tokenOut: Address,
    _amountsIn: bigint[],
    blockNumber: number,
  ): Promise<bigint[] | null> {
    if (!this.vault) return null;
    const vault = this.vault!;
    const state = await this.getStateOrGenerate(blockNumber);
    const priceIn = vault.getMinPrice(state, _tokenIn);
    const priceOut = vault.getMaxPrice(state, _tokenOut);

    const tokenInDecimals = vault.tokenDecimals[_tokenIn];
    const tokenOutDecimals = vault.tokenDecimals[_tokenOut];

    const isStableSwap =
      vault.stableTokens[_tokenIn] && vault.stableTokens[_tokenOut];
    const baseBps = isStableSwap
      ? vault.stableSwapFeeBasisPoints
      : vault.swapFeeBasisPoints;
    const taxBps = isStableSwap
      ? vault.stableTaxBasisPoints
      : vault.taxBasisPoints;
    const USDGUnit = BigInt(10 ** this.USDG_DECIMALS);
    const tokenInUnit = BigInt(10 ** tokenInDecimals);
    const tokenOutUnit = BigInt(10 ** tokenOutDecimals);

    return _amountsIn.map(_amountIn => {
      let feeBasisPoints;
      {
        let usdgAmount = (_amountIn * priceIn) / this.PRICE_PRECISION;
        usdgAmount = (usdgAmount * USDGUnit) / tokenInUnit;

        const feesBasisPoints0 = vault.getFeeBasisPoints(
          state,
          _tokenIn,
          usdgAmount,
          baseBps,
          taxBps,
          true,
        );
        const feesBasisPoints1 = vault.getFeeBasisPoints(
          state,
          _tokenOut,
          usdgAmount,
          baseBps,
          taxBps,
          false,
        );
        // use the higher of the two fee basis points
        feeBasisPoints =
          feesBasisPoints0 > feesBasisPoints1
            ? feesBasisPoints0
            : feesBasisPoints1;
      }

      let amountOut = (_amountIn * priceIn) / priceOut;
      amountOut = (amountOut * tokenOutUnit) / tokenInUnit;

      const amountOutAfterFees =
        (amountOut * (this.BASIS_POINTS_DIVISOR - feeBasisPoints)) /
        this.BASIS_POINTS_DIVISOR;
      return amountOutAfterFees;
    });
  }
}
