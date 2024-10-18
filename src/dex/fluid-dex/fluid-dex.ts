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
  FluidDexPoolState,
  Pool,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import FluidDexPoolABI from '../../abi/fluid-dex/fluid-dex.abi.json';
import { FluidDexConfig, Adapters, FLUID_DEX_GAS_COST } from './config';
import { FluidDexEventPool } from './fluid-dex-pool';
import { FluidDexCommonAddresses } from './fluid-dex-generate-pool';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { extractReturnAmountPosition } from '../../executor/utils';
import { MultiResult } from '../../lib/multi-wrapper';
import { generalDecoder } from '../../lib/decoders';
// @ts-ignore
import { Tokens } from '../../../tests/constants-e2e';

export class FluidDex extends SimpleExchange implements IDex<FluidDexData> {
  eventPools: { [id: string]: FluidDexEventPool } = {};
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(FluidDexConfig);

  logger: Logger;

  pools: FluidDexPool[];

  readonly fluidCommonAddresses: FluidDexCommonAddresses;

  readonly fluidDexPoolIface: Interface;

  protected adapters;

  FEE_100_PERCENT = BigInt(1000000);

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.fluidCommonAddresses = new FluidDexCommonAddresses(
      'FluidDex',
      FluidDexConfig['FluidDex'][network].commonAddresses,
      network,
      dexHelper,
      this.logger,
    );
    this.pools = FluidDexConfig['FluidDex'][network].pools;
    this.adapters = Adapters[network] || {};
    this.fluidDexPoolIface = new Interface(FluidDexPoolABI);
  }

  private async fetchFluidDexPools(
    blockNumber: number,
  ): Promise<FluidDexPool[]> {
    const poolsFromResolver =
      await this.fluidCommonAddresses.getStateOrGenerate(blockNumber, false);
    return poolsFromResolver.map(pool => ({
      id: `FluidDex_${pool.address.toLowerCase()}`,
      address: pool.address.toLowerCase(),
      token0: pool.token0.toLowerCase(),
      token1: pool.token1.toLowerCase(),
    }));
  }

  async updatePoolAndEventPool(blockNumber: number) {
    this.pools = await this.fetchFluidDexPools(blockNumber);
    for (const pool of this.pools) {
      if (!this.eventPools[pool.id]) {
        this.eventPools[pool.id] = new FluidDexEventPool(
          'FluidDex',
          pool.address,
          this.fluidCommonAddresses.commonAddresses,
          this.network,
          this.dexHelper,
          this.logger,
        );
      }
    }
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.updatePoolAndEventPool(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
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
    await this.updatePoolAndEventPool(blockNumber);
    const pool = await this.getPoolByTokenPair(
      srcToken.address,
      destToken.address,
    );
    return pool ? [pool.id] : [];
  }

  async getPoolByTokenPair(
    srcToken: Address,
    destToken: Address,
  ): Promise<FluidDexPool | null> {
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
    await this.updatePoolAndEventPool(blockNumber);
    try {
      if (side === SwapSide.BUY) throw new Error(`Buy not supported`);
      // Get the pool to use.
      const pool = await this.getPoolByTokenPair(
        srcToken.address,
        destToken.address,
      );
      if (!pool) return null;

      // Make sure the pool meets the optional limitPools filter.
      if (limitPools && !limitPools.includes(pool.id)) return null;

      const eventPool = this.eventPools[pool.id];

      if (!eventPool) {
        this.logger.error(`fluid-dex pool ${pool.id}: No EventPool found.`);

        return null;
      }

      const state = await eventPool.getStateOrGenerate(blockNumber);

      const prices = amounts.map(amount => {
        return this.swapIn(
          srcToken.address.toLowerCase() === pool.token0.toLowerCase(),
          amount,
          state.collateralReserves,
          state.debtReserves,
          srcToken.decimals,
          destToken.decimals,
          BigInt(state.fee),
        );
      });

      return [
        {
          prices: prices,
          unit: getBigIntPow(
            (side === SwapSide.SELL ? destToken : srcToken).decimals,
          ),
          data: {
            colReserves: state.collateralReserves,
            debtReserves: state.debtReserves,
            exchange: this.dexKey,
          },
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
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);
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
    this.initializePricing(await this.dexHelper.provider.getBlockNumber());
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const latestBlockNumber_ = await this.dexHelper.provider.getBlockNumber();
    let liquidityAmounts: { [id: string]: bigint } = {};
    for (const pool of this.pools) {
      if (
        pool.token0 === tokenAddress.toLowerCase() ||
        pool.token1 === tokenAddress.toLowerCase()
      ) {
        const state: FluidDexPoolState = await this.eventPools[
          pool.id
        ].getStateOrGenerate(latestBlockNumber_, false);

        liquidityAmounts[pool.id] =
          pool.token0 === tokenAddress
            ? state.collateralReserves.token0RealReserves +
              state.debtReserves.token0RealReserves
            : state.collateralReserves.token1RealReserves +
              state.debtReserves.token1RealReserves;
      }
    }

    const entries = Object.entries(liquidityAmounts);

    // Sort the entries based on the values in descending order
    entries.sort((a, b) => {
      if (b[1] > a[1]) return 1;
      if (b[1] < a[1]) return -1;
      return 0;
    });

    // Take the top k entries
    const topKEntries = entries.slice(0, limit);

    // Convert the array back to an object
    const sortedAmounts = Object.fromEntries(topKEntries);

    const poolLiquidities: PoolLiquidity[] = [];

    for (const [id, amount] of Object.entries(sortedAmounts)) {
      const pool = this.pools.find(p => p.id === id);
      if (!pool) continue; // Skip if pool not found

      const state: FluidDexPoolState = await this.eventPools[
        pool.id
      ].getStateOrGenerate(latestBlockNumber_, false);

      let token0decimals: number;
      for (const [networkStr, symbolMapping] of Object.entries(Tokens)) {
        let found = false;
        for (const [symbol, tokenParams] of Object.entries(symbolMapping)) {
          if (tokenParams.address.toLowerCase() === pool.token0.toLowerCase()) {
            token0decimals = tokenParams.decimals;
            found = true;
            break;
          }
          if (found) break;
        }
      }

      let token1decimals: number;
      for (const [networkStr, symbolMapping] of Object.entries(Tokens)) {
        let found = false;
        for (const [symbol, tokenParams] of Object.entries(symbolMapping)) {
          if (tokenParams.address.toLowerCase() === pool.token1.toLowerCase()) {
            token1decimals = tokenParams.decimals;
            found = true;
            break;
          }
          if (found) break;
        }
      }

      const usd0 = await this.dexHelper.getTokenUSDPrice(
        { address: pool.token0, decimals: token0decimals! },
        state.collateralReserves.token0RealReserves +
          state.debtReserves.token0RealReserves,
      );

      const usd1 = await this.dexHelper.getTokenUSDPrice(
        { address: pool.token1, decimals: token1decimals! },
        state.collateralReserves.token1RealReserves +
          state.debtReserves.token1RealReserves,
      );

      poolLiquidities.push({
        exchange: 'FluidDex',
        address: pool.address,
        connectorTokens: [],
        liquidityUSD: Number(usd0 + usd1), // converted to number
      });
    }
    return poolLiquidities;
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
    const latestBlockNumber_ = await this.dexHelper.provider.getBlockNumber();
    await this.updatePoolAndEventPool(latestBlockNumber_);

    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    let args: any;
    let returnAmountPos: number | undefined = undefined;

    const method = 'swapIn';

    returnAmountPos = extractReturnAmountPosition(
      this.fluidDexPoolIface,
      method,
      'amountOut_',
      1,
    );

    const pool = await this.getPoolByTokenPair(srcToken, destToken);

    if (pool!.token0.toLowerCase() != srcToken.toLowerCase()) {
      args = [false, BigInt(srcAmount), BigInt(destAmount), recipient];
    } else {
      args = [true, BigInt(srcAmount), BigInt(destAmount), recipient];
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
  private swapIn(
    swap0To1: boolean,
    amountIn: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
    inDecimals: number,
    outDecimals: number,
    fee: bigint,
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
      amountInAdjusted, // Convert back to number for internal calculations
      colReserves,
      debtReserves,
    );
    const result = (amountOut * BigInt(10 ** outDecimals)) / BigInt(10 ** 12);
    return result;
  }

  /**
   * Calculates the output amount for a given input amount in a swap operation.
   * @param swap0To1 - Direction of the swap. True if swapping token0 for token1, false otherwise.
   * @param amountToSwap - The amount of input token to be swapped.
   * @param colReserves - The reserves of the collateral pool.
   * @param debtReserves - The reserves of the debt pool.
   * @returns The calculated output amount.
   */
  private swapInAdjusted(
    swap0To1: boolean,
    amountToSwap: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
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

    let colIReserveIn: bigint,
      colIReserveOut: bigint,
      debtIReserveIn: bigint,
      debtIReserveOut: bigint;

    if (swap0To1) {
      colIReserveIn = token0ImaginaryReserves;
      colIReserveOut = token1ImaginaryReserves;
      debtIReserveIn = debtToken0ImaginaryReserves;
      debtIReserveOut = debtToken1ImaginaryReserves;
    } else {
      colIReserveIn = token1ImaginaryReserves;
      colIReserveOut = token0ImaginaryReserves;
      debtIReserveIn = debtToken1ImaginaryReserves;
      debtIReserveOut = debtToken0ImaginaryReserves;
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
      a = BigInt(-1); // Route from debt pool
    } else if (colPoolEnabled) {
      a = amountToSwap + BigInt(1); // Route from collateral pool
    } else {
      throw new Error('No pools are enabled');
    }

    let amountOutCollateral = BigInt(0);
    let amountOutDebt = BigInt(0);

    if (a <= BigInt(0)) {
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
   * Given an input amount of asset and pair reserves, returns the maximum output amount of the other asset.
   * @param amountIn - The amount of input asset.
   * @param iReserveIn - Imaginary token reserve with input amount.
   * @param iReserveOut - Imaginary token reserve of output amount.
   * @returns The maximum output amount of the other asset.
   */
  private getAmountOut(
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
  private getAmountIn(
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
  private swapRoutingOut(
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
  private swapRoutingIn(
    t: bigint,
    x: bigint,
    y: bigint,
    x2: bigint,
    y2: bigint,
  ): bigint {
    // Adding 1e18 precision

    const xyRoot = BigInt(Math.floor(Math.sqrt(Number(x * y * BigInt(1e18)))));
    const x2y2Root = BigInt(
      Math.floor(Math.sqrt(Number(x2 * y2 * BigInt(1e18)))),
    );

    // Calculating 'a' using the given formula
    const a =
      (Number(y2) * Number(xyRoot) +
        Number(t) * Number(xyRoot) -
        Number(y) * Number(x2y2Root)) /
      (Number(xyRoot) + Number(x2y2Root));
    return BigInt(Math.floor(a));
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
  private swapOut(
    swap0to1: boolean,
    amountOut: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
    inDecimals: number,
    outDecimals: number,
    fee: bigint,
  ): bigint {
    const amountOutAdjusted =
      (amountOut * BigInt(10 ** 12)) / BigInt(10 ** outDecimals);
    const amountIn = this.swapOutAdjusted(
      swap0to1,
      amountOutAdjusted,
      colReserves,
      debtReserves,
    );

    const FEE_100_PERCENT = BigInt(1e6); // Assuming this constant is defined elsewhere

    const result =
      ((amountIn * FEE_100_PERCENT) / (FEE_100_PERCENT - fee)) *
      BigInt(10 ** (inDecimals - 12));

    return result;
  }

  /**
   * Calculates the input amount for a given output amount in a swap operation.
   * @param {boolean} swap0to1 - Direction of the swap. True if swapping token0 for token1, false otherwise.
   * @param {bigint} amountOut - The amount of output token to be swapped.
   * @param {CollateralReserves} colReserves - The reserves of the collateral pool.
   * @param {DebtReserves} debtReserves - The reserves of the debt pool.
   * @returns {bigint} The calculated input amount required for the swap.
   */
  private swapOutAdjusted(
    swap0to1: boolean,
    amountOut: bigint,
    colReserves: CollateralReserves,
    debtReserves: DebtReserves,
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
      token0RealReserves > 0n &&
      token1RealReserves > 0n &&
      token0ImaginaryReserves > 0n &&
      token1ImaginaryReserves > 0n;

    // Check if all reserves of debt pool are greater than 0
    const debtPoolEnabled =
      debtToken0RealReserves > 0n &&
      debtToken1RealReserves > 0n &&
      debtToken0ImaginaryReserves > 0n &&
      debtToken1ImaginaryReserves > 0n;

    let colIReserveIn: bigint,
      colIReserveOut: bigint,
      debtIReserveIn: bigint,
      debtIReserveOut: bigint;

    if (swap0to1) {
      colIReserveIn = token0ImaginaryReserves;
      colIReserveOut = token1ImaginaryReserves;
      debtIReserveIn = debtToken0ImaginaryReserves;
      debtIReserveOut = debtToken1ImaginaryReserves;
    } else {
      colIReserveIn = token1ImaginaryReserves;
      colIReserveOut = token0ImaginaryReserves;
      debtIReserveIn = debtToken1ImaginaryReserves;
      debtIReserveOut = debtToken0ImaginaryReserves;
    }

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
      a = -1n; // Route from debt pool
    } else if (colPoolEnabled) {
      a = amountOut + 1n; // Route from collateral pool
    } else {
      throw new Error('No pools are enabled');
    }

    let amountInCollateral = 0n;
    let amountInDebt = 0n;

    if (a <= 0n) {
      // Entire trade routes through debt pool
      amountInDebt = this.getAmountIn(
        amountOut,
        debtIReserveIn,
        debtIReserveOut,
      );
    } else if (a >= amountOut) {
      // Entire trade routes through collateral pool
      amountInCollateral = this.getAmountIn(
        amountOut,
        colIReserveIn,
        colIReserveOut,
      );
    } else {
      // Trade routes through both pools
      amountInCollateral = this.getAmountIn(a, colIReserveIn, colIReserveOut);
      amountInDebt = this.getAmountIn(
        amountOut - a,
        debtIReserveIn,
        debtIReserveOut,
      );
    }

    const totalAmountIn = amountInCollateral + amountInDebt;

    return totalAmountIn;
  }
}
