import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  CollateralReserves,
  DebtReserves,
  FluidDexData,
  FluidDexPool,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { FluidDexConfig, Adapters, FLUID_DEX_GAS_COST } from './config';
import { FluidDexEventPool } from './fluid-dex-pool';
import { applyTransferFee } from '../../lib/token-transfer-fee';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';

export class FluidDex extends SimpleExchange implements IDex<FluidDexData> {
  readonly eventPools: { [id: string]: FluidDexEventPool } = {};

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(FluidDexConfig);

  logger: Logger;

  readonly pools: [FluidDexPool];

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.pools = FluidDexConfig[dexKey][network].pools;
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
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
    // return [];
    const pool = this.getPoolByTokenPair(srcToken, destToken);
    return pool ? [pool.id] : [];
  }

  getPoolByTokenPair(srcToken: Token, destToken: Token): FluidDexPool | null {
    const srcAddress = srcToken.address.toLowerCase();
    const destAddress = destToken.address.toLowerCase();

    // A pair must have 2 different tokens.
    if (srcAddress === destAddress) return null;

    for (const pool of this.pools) {
      if (
        (srcAddress === pool.token0 && destAddress === pool.token1) ||
        (srcAddress === pool.token1 && destAddress === pool.token0)
      ) {
        return pool;
      }
    }
    return null;
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
  ): Promise<null | ExchangePrices<FluidDexData>> {
    try {
      // Get the pool to use.
      const pool = this.getPoolByTokenPair(srcToken, destToken);
      if (!pool) return null;

      // Make sure the pool meets the optional limitPools filter.
      if (limitPools && !limitPools.includes(pool.id)) return null;

      const eventPool = this.eventPools[pool.id];

      if (!eventPool) {
        this.logger.error(`OSwap pool ${pool.id}: No EventPool found.`);

        return null;
      }

      const state = await eventPool.getStateOrGenerate(blockNumber);

      const swap0To1: boolean = side === SwapSide.SELL;

      const prices = amounts.map(amount =>
        // this.calcPrice(pool, state, srcToken, amount, side),
        this.swapIn(
          swap0To1,
          amount,
          state.collateralReserves,
          state.debtReserves,
        ),
      );

      return [
        {
          prices: amounts, // to be done
          unit: getBigIntPow(
            (side === SwapSide.SELL ? destToken : srcToken).decimals,
          ), // to be done
          data: {
            colReserves: state.collateralReserves,
            debtReserves: state.debtReserves,
            exchange: this.dexKey,
          },
          exchange: this.dexKey,
          poolIdentifier: pool.id,
          gasCost: FLUID_DEX_GAS_COST, // to be done
          poolAddresses: [pool.address],
        },
      ];
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.address || srcToken.symbol}, ${
          destToken.address || destToken.symbol
        }, ${side}:`,
        e,
      );

      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<FluidDexData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: FluidDexData,
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

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }

  /**
   * Calculates the output amount for a given input amount in a swap operation.
   * @param {boolean} swap0To1 - Direction of the swap. True if swapping token0 for token1, false otherwise.
   * @param {number} amountToSwap - The amount of input token to be swapped.
   * @param {Object} colReserves - The reserves of the collateral pool.
   * @param {number} colReserves.token0RealReserves - Real reserves of token0 in the collateral pool.
   * @param {number} colReserves.token1RealReserves - Real reserves of token1 in the collateral pool.
   * @param {number} colReserves.token0ImaginaryReserves - Imaginary reserves of token0 in the collateral pool.
   * @param {number} colReserves.token1ImaginaryReserves - Imaginary reserves of token1 in the collateral pool.
   * @param {Object} debtReserves - The reserves of the debt pool.
   * @param {number} debtReserves.token0RealReserves - Real reserves of token0 in the debt pool.
   * @param {number} debtReserves.token1RealReserves - Real reserves of token1 in the debt pool.
   * @param {number} debtReserves.token0ImaginaryReserves - Imaginary reserves of token0 in the debt pool.
   * @param {number} debtReserves.token1ImaginaryReserves - Imaginary reserves of token1 in the debt pool.
   * @returns {Object} An object containing the input amount and the calculated output amount.
   * @returns {number} amountIn - The input amount.
   * @returns {number} amountOut - The calculated output amount.
   */
  swapIn(
    swap0To1: boolean,
    amountToSwap: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
  ) {
    const {
      token0RealReserves,
      token1RealReserves,
      token0ImaginaryReserves,
      token1ImaginaryReserves,
    } = colReserves;

    const {
      token0RealReserves: debtToken0RealReserves,
      token1RealReserves: debtToken1RealReserves,
      token0ImaginaryReserves: debtToken0ImaginaryReserves,
      token1ImaginaryReserves: debtToken1ImaginaryReserves,
    } = debtReserves;

    // Convert all reserves to BigInt
    const colPoolEnabled =
      BigInt(token0RealReserves) > 0n &&
      BigInt(token1RealReserves) > 0n &&
      BigInt(token0ImaginaryReserves) > 0n &&
      BigInt(token1ImaginaryReserves) > 0n;

    const debtPoolEnabled =
      BigInt(debtToken0RealReserves) > 0n &&
      BigInt(debtToken1RealReserves) > 0n &&
      BigInt(debtToken0ImaginaryReserves) > 0n &&
      BigInt(debtToken1ImaginaryReserves) > 0n;

    let colIReserveIn, colIReserveOut, debtIReserveIn, debtIReserveOut;

    if (swap0To1) {
      colIReserveIn = BigInt(token0ImaginaryReserves);
      colIReserveOut = BigInt(token1ImaginaryReserves);
      debtIReserveIn = BigInt(debtToken0ImaginaryReserves);
      debtIReserveOut = BigInt(debtToken1ImaginaryReserves);
    } else {
      colIReserveIn = BigInt(token1ImaginaryReserves);
      colIReserveOut = BigInt(token0ImaginaryReserves);
      debtIReserveIn = BigInt(debtToken1ImaginaryReserves);
      debtIReserveOut = BigInt(debtToken0ImaginaryReserves);
    }

    let a: bigint;
    if (colPoolEnabled && debtPoolEnabled) {
      a = this.swapRoutingIn(
        amountToSwap,
        colIReserveOut,
        colIReserveIn,
        debtIReserveOut,
        debtIReserveIn,
      );
    } else if (debtPoolEnabled) {
      a = -1n; // Route from debt pool
    } else if (colPoolEnabled) {
      a = amountToSwap + 1n; // Route from collateral pool
    } else {
      throw new Error('No pools are enabled');
    }

    let amountOutCollateral: bigint = 0n;
    let amountOutDebt: bigint = 0n;

    if (a <= 0n) {
      // Entire trade routes through debt pool
      amountOutDebt = this.getAmountOut(
        amountToSwap,
        debtIReserveIn,
        debtIReserveOut,
      );
    } else if (a >= amountToSwap) {
      // Entire trade routes through collateral pool
      amountOutCollateral = this.getAmountOut(
        amountToSwap,
        colIReserveIn,
        colIReserveOut,
      );
    } else {
      // Trade routes through both pools
      amountOutCollateral = this.getAmountOut(a, colIReserveIn, colIReserveOut);
      amountOutDebt = this.getAmountOut(
        amountToSwap - a,
        debtIReserveIn,
        debtIReserveOut,
      );
    }

    const totalAmountOut = amountOutCollateral + amountOutDebt;

    return totalAmountOut;
  }

  /**
   * Calculates how much of a swap should go through the collateral pool.
   * @param {number} t - Total amount in.
   * @param {number} x - Imaginary reserves of token out of collateral.
   * @param {number} y - Imaginary reserves of token in of collateral.
   * @param {number} x2 - Imaginary reserves of token out of debt.
   * @param {number} y2 - Imaginary reserves of token in of debt.
   * @returns {number} a - How much swap should go through collateral pool. Remaining will go from debt.
   * @note If a < 0 then entire trade route through debt pool and debt pool arbitrage with col pool.
   * @note If a > t then entire trade route through col pool and col pool arbitrage with debt pool.
   * @note If a > 0 & a < t then swap will route through both pools.
   */
  swapRoutingIn(
    t: bigint,
    x: bigint,
    y: bigint,
    x2: bigint,
    y2: bigint,
  ): bigint {
    const precision = BigInt(1e18);

    // Helper function for integer square root
    const sqrtBigInt = (value: bigint): bigint => {
      if (value < 0n) {
        throw new Error('Square root of negative number is not allowed');
      }
      if (value < 2n) {
        return value;
      }

      let x = value;
      let y = (x + 1n) / 2n;
      while (y < x) {
        x = y;
        y = (x + value / x) / 2n;
      }
      return x;
    };

    const xyRoot = sqrtBigInt((x * y * precision) / precision);
    const x2y2Root = sqrtBigInt((x2 * y2 * precision) / precision);

    // Calculating 'a' using the given formula
    const numerator = y2 * xyRoot + t * xyRoot - y * x2y2Root;
    const denominator = xyRoot + x2y2Root;

    // Perform the division and maintain precision
    const a = (numerator * precision) / denominator / precision;

    return a;
  }

  /**
   * Given an input amount of asset and pair reserves, returns the maximum output amount of the other asset.
   * @param {number} amountIn - The amount of input asset.
   * @param {number} iReserveIn - Imaginary token reserve with input amount.
   * @param {number} iReserveOut - Imaginary token reserve of output amount.
   * @returns {number} - The maximum output amount of the other asset.
   */
  getAmountOut(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
  ): bigint {
    // Both numerator and denominator are scaled to 1e6 to factor in fee scaling.
    const scale = BigInt(1_000_000);
    const numerator = amountIn * reserveOut * scale;
    const denominator = reserveIn * scale + amountIn * scale;

    // Using the swap formula: (AmountIn * ReserveOut * scale) / (ReserveIn * scale + AmountIn * scale)
    return numerator / denominator;
  }
}
