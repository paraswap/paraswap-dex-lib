import { BytesLike } from 'ethers/lib/utils';
import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  PoolLiquidity,
  DexExchangeParam,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { Context, IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  CollateralReserves,
  DebtReserves,
  FluidDexData,
  FluidDexPool,
  Pool,
  DexLimits,
  TokenLimit,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import FluidDexPoolABI from '../../abi/fluid-dex/fluid-dex.abi.json';
import { FluidDexConfig, FLUID_DEX_GAS_COST } from './config';
import { FluidDexFactory } from './fluid-dex-factory';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { extractReturnAmountPosition } from '../../executor/utils';
import { MultiResult } from '../../lib/multi-wrapper';
import { generalDecoder } from '../../lib/decoders';
import { BigNumber } from 'ethers';
import { sqrt } from './utils';
import { FluidDexLiquidityProxy } from './fluid-dex-liquidity-proxy';

export class FluidDex extends SimpleExchange implements IDex<FluidDexData> {
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(FluidDexConfig);

  logger: Logger;

  pools: FluidDexPool[] = [];

  readonly factory: FluidDexFactory;

  readonly liquidityProxy: FluidDexLiquidityProxy;

  readonly fluidDexPoolIface: Interface;

  FEE_100_PERCENT = BigInt(1000000);

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.factory = new FluidDexFactory(
      dexKey,
      FluidDexConfig[dexKey][network].commonAddresses,
      network,
      dexHelper,
      this.logger,
      this.onPoolCreatedUpdatePools.bind(this),
    );

    this.liquidityProxy = new FluidDexLiquidityProxy(
      dexKey,
      this.factory.commonAddresses,
      this.network,
      this.dexHelper,
      this.logger,
    );

    this.fluidDexPoolIface = new Interface(FluidDexPoolABI);
  }

  private async fetchFluidDexPools(
    blockNumber: number,
  ): Promise<FluidDexPool[]> {
    const poolsFromFactory = await this.factory.getStateOrGenerate(
      blockNumber,
      false,
    );
    return this.generateFluidDexPoolsFromPoolsFactory(poolsFromFactory);
  }

  private generateFluidDexPoolsFromPoolsFactory(
    pools: readonly Pool[],
  ): FluidDexPool[] {
    return pools.map(pool => ({
      id: `FluidDex_${pool.address.toLowerCase()}`,
      address: pool.address.toLowerCase(),
      token0: pool.token0.toLowerCase(),
      token1: pool.token1.toLowerCase(),
    }));
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.factory.initialize(blockNumber);
    this.pools = await this.fetchFluidDexPools(blockNumber);

    await this.liquidityProxy.initialize(blockNumber);
  }

  getAdapters(side: SwapSide) {
    return null;
  }

  protected onPoolCreatedUpdatePools(poolsFromFactory: readonly Pool[]) {
    this.pools = this.generateFluidDexPoolsFromPoolsFactory(poolsFromFactory);
    this.logger.info(`${this.dexKey}: pools list was updated ...`);
  }

  decodePools = (result: MultiResult<BytesLike> | BytesLike): Pool[] => {
    return generalDecoder(
      result,
      ['tuple(address pool, address token0, address token1)[]'],
      undefined,
      decoded => {
        return decoded.map((decodedPool: any) => ({
          address: decodedPool[0][0].toLowerCase(),
          token0: decodedPool[0][1].toLowerCase(),
          token1: decodedPool[0][2].toLowerCase(),
        }));
      },
    );
  };

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
    const pool = this.getPoolByTokenPair(srcToken.address, destToken.address);
    return pool ? [pool.id] : [];
  }

  getPoolByTokenPair(
    srcToken: Address,
    destToken: Address,
  ): FluidDexPool | null {
    const srcAddress = srcToken.toLowerCase();
    const destAddress = destToken.toLowerCase();

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
      if (srcToken.address.toLowerCase() === destToken.address.toLowerCase())
        return null;
      // Get the pool to use.
      const pool = this.getPoolByTokenPair(srcToken.address, destToken.address);
      if (!pool) return null;
      // Make sure the pool meets the optional limitPools filter.
      if (limitPools && !limitPools.includes(pool.id)) return null;

      const liquidityProxyState = await this.liquidityProxy.getStateOrGenerate(
        blockNumber,
      );
      const currentPoolReserves = liquidityProxyState.poolsReserves.find(
        poolReserve =>
          poolReserve.pool.toLowerCase() === pool.address.toLowerCase(),
      );
      if (!currentPoolReserves) {
        return null;
      }
      const prices = amounts.map(amount => {
        if (side === SwapSide.SELL) {
          return this.swapIn(
            srcToken.address.toLowerCase() === pool.token0.toLowerCase(),
            amount,
            currentPoolReserves.collateralReserves,
            currentPoolReserves.debtReserves,
            srcToken.decimals,
            destToken.decimals,
            BigInt(currentPoolReserves.fee),
            currentPoolReserves.dexLimits,
            Math.floor(Date.now() / 1000),
          );
        } else {
          return this.swapOut(
            srcToken.address.toLowerCase() === pool.token0.toLowerCase(),
            amount,
            currentPoolReserves.collateralReserves,
            currentPoolReserves.debtReserves,
            srcToken.decimals,
            destToken.decimals,
            BigInt(currentPoolReserves.fee),
            currentPoolReserves.dexLimits,
            Math.floor(Date.now() / 1000),
          );
        }
      });
      return [
        {
          prices: prices,
          unit: getBigIntPow(destToken.decimals),
          data: {},
          exchange: this.dexKey,
          poolIdentifier: pool.id,
          gasCost: FLUID_DEX_GAS_COST,
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
    // Encode here the payload for adapter
    const payload = '';
    const pool = this.getPoolByTokenPair(srcToken, destToken);

    return {
      targetExchange: pool!.address,
      payload,
      networkFee: '0',
    };
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //@TODO
    return [];
  }

  async getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: string,
    destAmount: string,
    recipient: Address,
    data: FluidDexData,
    side: SwapSide,
    context: Context,
    executorAddress: Address,
  ): Promise<DexExchangeParam> {
    let args: any;
    let returnAmountPos: number | undefined;

    const method = side === SwapSide.SELL ? 'swapIn' : 'swapOut';

    returnAmountPos = extractReturnAmountPosition(
      this.fluidDexPoolIface,
      method,
      side === SwapSide.SELL ? 'amountOut_' : 'amountIn_',
    );

    const pool = this.getPoolByTokenPair(srcToken, destToken);

    if (side === SwapSide.SELL) {
      if (pool!.token0.toLowerCase() !== srcToken.toLowerCase()) {
        args = [false, BigInt(srcAmount), BigInt(destAmount), recipient];
      } else {
        args = [true, BigInt(srcAmount), BigInt(destAmount), recipient];
      }
    } else {
      if (pool!.token0.toLowerCase() !== srcToken.toLowerCase()) {
        args = [false, BigInt(destAmount), BigInt(srcAmount), recipient];
      } else {
        args = [true, BigInt(destAmount), BigInt(srcAmount), recipient];
      }
    }
    const swapData = this.fluidDexPoolIface.encodeFunctionData(method, args);
    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData: swapData,
      targetExchange: pool!.address,
      returnAmountPos,
    };
  }

  /**
   * Calculates the output amount for a given input amount in a swap operation.
   * @param swap0To1 - Direction of the swap. True if swapping token0 for token1, false otherwise.
   * @param amountIn - The amount of input token to be swapped (as a BigInt).
   * @param colReserves - The reserves of the collateral pool.
   * @param debtReserves - The reserves of the debt pool.
   * @param inDecimals - The number of decimals for the input token.
   * @param outDecimals - The number of decimals for the output token.
   * @returns The calculated output amount (as a BigInt).
   */
  public swapIn(
    swap0To1: boolean,
    amountIn: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
    inDecimals: number,
    outDecimals: number,
    fee: bigint,
    currentLimits: DexLimits,
    syncTime: number,
  ): bigint {
    if (amountIn === 0n) {
      return 0n; // Return 0 if input amount is 0
    }
    if (
      colReserves.token0RealReserves + debtReserves.token0RealReserves == 0n &&
      colReserves.token1RealReserves + debtReserves.token1RealReserves == 0n
    ) {
      return 0n;
    }
    const amountInAdjusted =
      (((amountIn * (this.FEE_100_PERCENT - fee)) / this.FEE_100_PERCENT) *
        BigInt(10 ** 12)) /
      BigInt(10 ** inDecimals);
    const amountOut = this.swapInAdjusted(
      swap0To1,
      amountInAdjusted,
      colReserves,
      debtReserves,
      outDecimals,
      currentLimits,
      syncTime,
    );
    return (amountOut * BigInt(10 ** outDecimals)) / BigInt(10 ** 12);
  }

  /**
   * Calculates the output amount for a given input amount in a swap operation.
   * @param swap0To1 - Direction of the swap. True if swapping token0 for token1, false otherwise.
   * @param amountToSwap - The amount of input token to be swapped.
   * @param colReserves - The reserves of the collateral pool.
   * @param debtReserves - The reserves of the debt pool.
   * @returns The calculated output amount.
   */
  public swapInAdjusted(
    swap0To1: boolean,
    amountToSwap: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
    outDecimals: number,
    currentLimits: DexLimits,
    syncTime: number,
  ): bigint {
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

    // Check if all reserves of collateral pool are greater than 0
    const colPoolEnabled =
      token0RealReserves > 0 &&
      token1RealReserves > 0 &&
      token0ImaginaryReserves > 0 &&
      token1ImaginaryReserves > 0;

    // Check if all reserves of debt pool are greater than 0
    const debtPoolEnabled =
      debtToken0RealReserves > 0 &&
      debtToken1RealReserves > 0 &&
      debtToken0ImaginaryReserves > 0 &&
      debtToken1ImaginaryReserves > 0;

    let colReserveIn, colReserveOut, debtReserveIn, debtReserveOut;
    let colIReserveIn, colIReserveOut, debtIReserveIn, debtIReserveOut;
    let borrowable, withdrawable;

    if (swap0To1) {
      colReserveIn = token0RealReserves;
      colReserveOut = token1RealReserves;
      colIReserveIn = token0ImaginaryReserves;
      colIReserveOut = token1ImaginaryReserves;
      debtReserveIn = debtToken0RealReserves;
      debtReserveOut = debtToken1RealReserves;
      debtIReserveIn = debtToken0ImaginaryReserves;
      debtIReserveOut = debtToken1ImaginaryReserves;
      borrowable = this.getExpandedLimit(
        syncTime,
        currentLimits.borrowableToken1,
      );
      withdrawable = this.getExpandedLimit(
        syncTime,
        currentLimits.withdrawableToken1,
      );
    } else {
      colReserveIn = token1RealReserves;
      colReserveOut = token0RealReserves;
      colIReserveIn = token1ImaginaryReserves;
      colIReserveOut = token0ImaginaryReserves;
      debtReserveIn = debtToken1RealReserves;
      debtReserveOut = debtToken0RealReserves;
      debtIReserveIn = debtToken1ImaginaryReserves;
      debtIReserveOut = debtToken0ImaginaryReserves;
      borrowable = this.getExpandedLimit(
        syncTime,
        currentLimits.borrowableToken0,
      );
      withdrawable = this.getExpandedLimit(
        syncTime,
        currentLimits.withdrawableToken0,
      );
    }

    // bring borrowable and withdrawable from token decimals to 1e12 decimals, same as amounts
    borrowable = (borrowable * BigInt(10 ** 12)) / BigInt(10 ** outDecimals);
    withdrawable =
      (withdrawable * BigInt(10 ** 12)) / BigInt(10 ** outDecimals);

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

    let amountOutCollateral = 0n;
    let amountOutDebt = 0n;
    let amountInCollateral = 0n;
    let amountInDebt = 0n;

    if (a <= 0n) {
      // Entire trade routes through debt pool
      amountInDebt = amountToSwap;
      amountOutDebt = this.getAmountOut(
        amountToSwap,
        debtIReserveIn,
        debtIReserveOut,
      );
    } else if (a >= amountToSwap) {
      // Entire trade routes through collateral pool
      amountInCollateral = amountToSwap;
      amountOutCollateral = this.getAmountOut(
        amountToSwap,
        colIReserveIn,
        colIReserveOut,
      );
    } else {
      // Trade routes through both pools
      amountInCollateral = a;
      amountOutCollateral = this.getAmountOut(a, colIReserveIn, colIReserveOut);
      amountInDebt = amountToSwap - a;
      amountOutDebt = this.getAmountOut(
        amountInDebt,
        debtIReserveIn,
        debtIReserveOut,
      );
    }

    if (amountOutDebt > debtReserveOut) {
      return 0n;
    }
    if (amountOutDebt > borrowable) {
      return 0n;
    }

    if (amountOutCollateral > colReserveOut) {
      return 0n;
    }

    if (amountOutCollateral > withdrawable) {
      return 0n;
    }

    // For price calculations, we'll use a precision factor for bigint division
    const PRECISION = 1000000000000000000000000000n; // 1e27

    let oldPrice: bigint;
    let newPrice: bigint;

    if (amountInCollateral > amountInDebt) {
      // new pool price from col pool
      oldPrice = swap0To1
        ? (colIReserveOut * PRECISION) / colIReserveIn
        : (colIReserveIn * PRECISION) / colIReserveOut;

      newPrice = swap0To1
        ? ((colIReserveOut - amountOutCollateral) * PRECISION) /
          (colIReserveIn + amountInCollateral)
        : ((colIReserveIn + amountInCollateral) * PRECISION) /
          (colIReserveOut - amountOutCollateral);
    } else {
      // new pool price from debt pool
      oldPrice = swap0To1
        ? (debtIReserveOut * PRECISION) / debtIReserveIn
        : (debtIReserveIn * PRECISION) / debtIReserveOut;

      newPrice = swap0To1
        ? ((debtIReserveOut - amountOutDebt) * PRECISION) /
          (debtIReserveIn + amountInDebt)
        : ((debtIReserveIn + amountInDebt) * PRECISION) /
          (debtIReserveOut - amountOutDebt);
    }
    // Calculate price difference using bigint arithmetic
    const MAX_PRICE_DIFF = 5n; // 5%
    const priceDiff =
      oldPrice > newPrice ? oldPrice - newPrice : newPrice - oldPrice;
    const maxAllowedDiff = (oldPrice * MAX_PRICE_DIFF) / 100n;

    if (priceDiff > maxAllowedDiff) {
      return 0n;
    }
    const totalAmountOut = amountOutCollateral + amountOutDebt;

    return totalAmountOut;
  }

  /**
   * Calculates the currently available swappable amount for a token limit considering expansion since last syncTime.
   * @param syncTime - timestamp in seconds when the limits were synced
   * @param limit - token limit object containing available amount, expandsTo amount, and expandDuration
   * @returns The calculated available swappable amount (borrowable or withdrawable)
   */
  public getExpandedLimit(syncTime: number, limit: TokenLimit): bigint {
    const currentTime = Math.floor(Date.now() / 1000); // convert milliseconds to seconds
    const elapsedTime = currentTime - syncTime;
    limit.expandsDuration = limit.expandsDuration || 0n;
    if (elapsedTime < 10n) {
      // if almost no time has elapsed, return available amount
      return limit.available;
    }

    if (elapsedTime >= limit.expandsDuration) {
      // if duration has passed, return max amount
      return limit.expandsTo;
    }

    // Calculate expansion ratio using bigint arithmetic
    // Multiply by a large factor for precision in integer arithmetic
    const PRECISION = 1000000;
    const ratio = BigInt(elapsedTime * PRECISION) / limit.expandsDuration;

    // Calculate expanded amount with precision factor
    const expansion =
      ((limit.expandsTo - limit.available) * ratio) / BigInt(PRECISION);
    const expandedAmount = limit.available + expansion;
    return expandedAmount;
  }

  /**
   * Given an input amount of asset and pair reserves, returns the maximum output amount of the other asset.
   * @param amountIn - The amount of input asset.
   * @param iReserveIn - Imaginary token reserve with input amount.
   * @param iReserveOut - Imaginary token reserve of output amount.
   * @returns The maximum output amount of the other asset.
   */
  public getAmountOut(
    amountIn: bigint,
    iReserveIn: bigint,
    iReserveOut: bigint,
  ): bigint {
    // Both numerator and denominator are scaled to 1e6 to factor in fee scaling.
    const numerator = amountIn * iReserveOut;
    const denominator = iReserveIn + amountIn;

    // Using the swap formula: (AmountIn * iReserveY) / (iReserveX + AmountIn)
    // We use division with rounding down, which is the default for bigint division

    return numerator / denominator;
  }

  /**
   * Given an output amount of asset and pair reserves, returns the input amount of the other asset
   * @param amountOut - Desired output amount of the asset.
   * @param iReserveIn - Imaginary token reserve of input amount.
   * @param iReserveOut - Imaginary token reserve of output amount.
   * @returns The input amount of the other asset.
   */
  public getAmountIn(
    amountOut: bigint,
    iReserveIn: bigint,
    iReserveOut: bigint,
  ): bigint {
    // Both numerator and denominator are scaled to 1e6 to factor in fee scaling.
    const numerator = amountOut * iReserveIn;
    const denominator = iReserveOut - amountOut;

    // Using the swap formula: (AmountOut * iReserveX) / (iReserveY - AmountOut)
    return numerator / denominator;
  }

  /**
   * Calculates how much of a swap should go through the collateral pool for output amount.
   * @param t - Total amount out.
   * @param x - Imaginary reserves of token in of collateral.
   * @param y - Imaginary reserves of token out of collateral.
   * @param x2 - Imaginary reserves of token in of debt.
   * @param y2 - Imaginary reserves of token out of debt.
   * @returns How much swap should go through collateral pool. Remaining will go from debt.
   * @note If a < 0 then entire trade route through debt pool and debt pool arbitrage with col pool.
   * @note If a > t then entire trade route through col pool and col pool arbitrage with debt pool.
   * @note If a > 0 & a < t then swap will route through both pools.
   */
  public swapRoutingOut(
    t: bigint,
    x: bigint,
    y: bigint,
    x2: bigint,
    y2: bigint,
  ): bigint {
    // Adding 1e18 precision
    const xyRoot = BigInt(
      Math.floor(Math.sqrt(Number(x * y * BigInt(10n ** 18n)))),
    );
    const x2y2Root = BigInt(
      Math.floor(Math.sqrt(Number(x2 * y2 * BigInt(10n ** 18n)))),
    );

    // 1e18 precision gets cancelled out in division
    const numerator = t * xyRoot + y * x2y2Root - y2 * xyRoot;
    const denominator = xyRoot + x2y2Root;

    // Use integer division (rounds down)
    const a = numerator / denominator;

    return a;
  }

  /**
   * Calculates how much of a swap should go through the collateral pool.
   * @param t - Total amount in.
   * @param x - Imaginary reserves of token out of collateral.
   * @param y - Imaginary reserves of token in of collateral.
   * @param x2 - Imaginary reserves of token out of debt.
   * @param y2 - Imaginary reserves of token in of debt.
   * @returns How much swap should go through collateral pool. Remaining will go from debt.
   * @note If a < 0 then entire trade route through debt pool and debt pool arbitrage with col pool.
   * @note If a > t then entire trade route through col pool and col pool arbitrage with debt pool.
   * @note If a > 0 & a < t then swap will route through both pools.
   */
  public swapRoutingIn(
    t: bigint,
    x: bigint,
    y: bigint,
    x2: bigint,
    y2: bigint,
  ): bigint {
    // Adding 1e18 precision

    const xyRoot = sqrt(BigNumber.from(x).mul(y).mul(BigInt(1e18))).toBigInt();
    const x2y2Root = sqrt(
      BigNumber.from(x2).mul(y2).mul(BigInt(1e18)),
    ).toBigInt();

    // Calculating 'a' using the given formula
    const a = (y2 * xyRoot + t * xyRoot - y * x2y2Root) / (xyRoot + x2y2Root);
    return a;
  }

  /**
   * Calculates the input amount for a given output amount in a swap operation.
   * @param {boolean} swap0to1 - Direction of the swap. True if swapping token0 for token1, false otherwise.
   * @param {bigint} amountOut - The amount of output token to be swapped.
   * @param {Reserves} colReserves - The reserves of the collateral pool.
   * @param {Reserves} debtReserves - The reserves of the debt pool.
   * @param {number} inDecimals - The number of decimals for the input token.
   * @param {number} outDecimals - The number of decimals for the output token.
   * @param {number} fee - The fee for the swap. 1e4 = 1%
   * @returns {bigint} amountIn - The calculated input amount required for the swap.
   */
  public swapOut(
    swap0to1: boolean,
    amountOut: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
    inDecimals: number,
    outDecimals: number,
    fee: bigint,
    currentLimits: DexLimits,
    syncTime: number,
  ): bigint {
    const amountOutAdjusted =
      (amountOut * BigInt(10 ** 12)) / BigInt(10 ** outDecimals);
    const amountIn = this.swapOutAdjusted(
      swap0to1,
      amountOutAdjusted,
      colReserves,
      debtReserves,
      outDecimals,
      currentLimits,
      syncTime,
    );

    if (amountIn == 2n ** 256n - 1n) {
      return amountIn;
    }
    const ans =
      (amountIn * this.FEE_100_PERCENT * BigInt(10 ** inDecimals)) /
      BigInt(10 ** 12) /
      (this.FEE_100_PERCENT - fee);
    return ans;
  }

  /**
   * Calculates the input amount for a given output amount in a swap operation.
   * @param {boolean} swap0to1 - Direction of the swap. True if swapping token0 for token1, false otherwise.
   * @param {bigint} amountOut - The amount of output token to be swapped.
   * @param {CollateralReserves} colReserves - The reserves of the collateral pool.
   * @param {DebtReserves} debtReserves - The reserves of the debt pool.
   * @returns {bigint} The calculated input amount required for the swap.
   */
  public swapOutAdjusted(
    swap0to1: boolean,
    amountOut: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
    outDecimals: number,
    currentLimits: DexLimits,
    syncTime: number,
  ): bigint {
    if (amountOut === 0n) {
      return 0n; // Return 0 if output amount is 0
    }
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

    // Check if all reserves of collateral pool are greater than 0
    const colPoolEnabled =
      token0RealReserves > BigInt(0) &&
      token1RealReserves > BigInt(0) &&
      token0ImaginaryReserves > BigInt(0) &&
      token1ImaginaryReserves > BigInt(0);

    // Check if all reserves of debt pool are greater than 0
    const debtPoolEnabled =
      debtToken0RealReserves > BigInt(0) &&
      debtToken1RealReserves > BigInt(0) &&
      debtToken0ImaginaryReserves > BigInt(0) &&
      debtToken1ImaginaryReserves > BigInt(0);

    let colReserveIn: bigint,
      colReserveOut: bigint,
      debtReserveIn: bigint,
      debtReserveOut: bigint;
    let colIReserveIn: bigint,
      colIReserveOut: bigint,
      debtIReserveIn: bigint,
      debtIReserveOut: bigint;
    let borrowable: bigint, withdrawable: bigint;

    if (swap0to1) {
      colReserveIn = token0RealReserves;
      colReserveOut = token1RealReserves;
      colIReserveIn = token0ImaginaryReserves;
      colIReserveOut = token1ImaginaryReserves;
      debtReserveIn = debtToken0RealReserves;
      debtReserveOut = debtToken1RealReserves;
      debtIReserveIn = debtToken0ImaginaryReserves;
      debtIReserveOut = debtToken1ImaginaryReserves;
      borrowable = this.getExpandedLimit(
        syncTime,
        currentLimits.borrowableToken1,
      );
      withdrawable = this.getExpandedLimit(
        syncTime,
        currentLimits.withdrawableToken1,
      );
    } else {
      colReserveIn = token1RealReserves;
      colReserveOut = token0RealReserves;
      colIReserveIn = token1ImaginaryReserves;
      colIReserveOut = token0ImaginaryReserves;
      debtReserveIn = debtToken1RealReserves;
      debtReserveOut = debtToken0RealReserves;
      debtIReserveIn = debtToken1ImaginaryReserves;
      debtIReserveOut = debtToken0ImaginaryReserves;
      borrowable = this.getExpandedLimit(
        syncTime,
        currentLimits.borrowableToken0,
      );
      withdrawable = this.getExpandedLimit(
        syncTime,
        currentLimits.withdrawableToken0,
      );
    }

    // bring borrowable and withdrawable from token decimals to 1e12 decimals, same as amounts
    borrowable = (borrowable * BigInt(10 ** 12)) / BigInt(10 ** outDecimals);
    withdrawable =
      (withdrawable * BigInt(10 ** 12)) / BigInt(10 ** outDecimals);

    let a: bigint;
    if (colPoolEnabled && debtPoolEnabled) {
      a = this.swapRoutingOut(
        amountOut,
        colIReserveIn,
        colIReserveOut,
        debtIReserveIn,
        debtIReserveOut,
      );
    } else if (debtPoolEnabled) {
      a = BigInt(-1); // Route from debt pool
    } else if (colPoolEnabled) {
      a = amountOut + BigInt(1); // Route from collateral pool
    } else {
      throw new Error('No pools are enabled');
    }

    let amountInCollateral: bigint = BigInt(0);
    let amountInDebt: bigint = BigInt(0);
    let amountOutCollateral: bigint = BigInt(0);
    let amountOutDebt: bigint = BigInt(0);

    if (a <= BigInt(0)) {
      // Entire trade routes through debt pool
      amountOutDebt = amountOut;
      amountInDebt = this.getAmountIn(
        amountOut,
        debtIReserveIn,
        debtIReserveOut,
      );
      if (amountOut > debtReserveOut) {
        return 2n ** 256n - 1n;
      }
      if (amountOut > borrowable) {
        return 2n ** 256n - 1n;
      }
    } else if (a >= amountOut) {
      // Entire trade routes through collateral pool
      amountOutCollateral = amountOut;
      amountInCollateral = this.getAmountIn(
        amountOut,
        colIReserveIn,
        colIReserveOut,
      );
      if (amountOut > colReserveOut) {
        return 2n ** 256n - 1n;
      }
      if (amountOut > withdrawable) {
        return 2n ** 256n - 1n;
      }
    } else {
      // Trade routes through both pools
      amountOutCollateral = a;
      amountInCollateral = this.getAmountIn(a, colIReserveIn, colIReserveOut);
      amountOutDebt = amountOut - a;
      amountInDebt = this.getAmountIn(
        amountOutDebt,
        debtIReserveIn,
        debtIReserveOut,
      );
      if (amountOutDebt > debtReserveOut || a > colReserveOut) {
        return 2n ** 256n - 1n;
      }
      if (amountOutDebt > borrowable || a > withdrawable) {
        return 2n ** 256n - 1n;
      }
    }

    let oldPrice: bigint;
    let newPrice: bigint;
    const SCALE = BigInt(1e27);

    // from whatever pool higher amount of swap is routing we are taking that as final price, does not matter much because both pools final price should be same
    if (amountOutCollateral > amountOutDebt) {
      // new pool price from col pool
      oldPrice = swap0to1
        ? (colIReserveOut * SCALE) / colIReserveIn
        : (colIReserveIn * SCALE) / colIReserveOut;
      newPrice = swap0to1
        ? ((colIReserveOut - amountOutCollateral) * SCALE) /
          (colIReserveIn + amountInCollateral)
        : ((colIReserveIn + amountInCollateral) * SCALE) /
          (colIReserveOut - amountOutCollateral);
    } else {
      // new pool price from debt pool
      oldPrice = swap0to1
        ? (debtIReserveOut * SCALE) / debtIReserveIn
        : (debtIReserveIn * SCALE) / debtIReserveOut;
      newPrice = swap0to1
        ? ((debtIReserveOut - amountOutDebt) * SCALE) /
          (debtIReserveIn + amountInDebt)
        : ((debtIReserveIn + amountInDebt) * SCALE) /
          (debtIReserveOut - amountOutDebt);
    }

    const MAX_PRICE_DIFF = BigInt(5); // 5%
    if (
      this.abs(oldPrice - newPrice) >
      (oldPrice / BigInt(100)) * MAX_PRICE_DIFF
    ) {
      // if price diff is > 5% then swap would revert.
      return 2n ** 256n - 1n;
    }

    const totalAmountIn = amountInCollateral + amountInDebt;

    return totalAmountIn;
  }

  private abs(value: bigint): bigint {
    return value < 0 ? -value : value;
  }
}
