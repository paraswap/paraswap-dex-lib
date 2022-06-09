import { Interface } from '@ethersproject/abi';
import { Contract } from 'web3-eth-contract';
import type { AbiItem } from 'web3-utils';

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
import { getBigIntPow, getDexKeysWithNetwork, wrapETH } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  DexParams,
  PoolState,
  UniswapV3Data,
  UniswapV3Functions,
  UniswapV3Param,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { UniswapV3Config, Adapters } from './config';
import { UniswapV3EventPool } from './uniswap-v3-pool';
import UniswapV3RouterABI from '../../abi/uniswap-v3/UniswapV3Router.abi.json';
import UniswapV3FactoryABI from '../../abi/uniswap-v3/UniswapV3Factory.abi.json';
import { UNISWAPV3_QUOTE_GASLIMIT } from './constants';
import { DeepReadonly } from 'ts-essentials';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';
import { TickMath } from './contract-math/TickMath';

export class UniswapV3
  extends SimpleExchange
  implements IDex<UniswapV3Data, UniswapV3Param>
{
  protected eventPools: Record<string, UniswapV3EventPool | null> = {};

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UniswapV3Config);

  logger: Logger;
  readonly factoryContract: Contract;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly routerIface = new Interface(UniswapV3RouterABI),
    protected config = UniswapV3Config[dexKey][network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);

    // Normalise once all config addresses and use across all scenarios
    this.config = this._toLowerForAllConfigAddresses();

    this.factoryContract = new this.dexHelper.web3Provider.eth.Contract(
      UniswapV3FactoryABI as AbiItem[],
      this.config.factory,
    );
  }

  get supportedFees() {
    return this.config.supportedFees;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolIdentifier(srcAddress: Address, destAddress: Address, fee: bigint) {
    const tokenAddresses = this._sortTokens(srcAddress, destAddress).join('_');
    return `${this.dexKey}_${tokenAddresses}_${fee}`;
  }

  async getPool(
    srcAddress: Address,
    destAddress: Address,
    fee: bigint,
    blockNumber: number,
  ): Promise<UniswapV3EventPool | null> {
    let pool =
      this.eventPools[this.getPoolIdentifier(srcAddress, destAddress, fee)];
    if (pool === undefined) {
      const [token0, token1] = this._sortTokens(srcAddress, destAddress);

      try {
        const poolAddress = await this.factoryContract.methods
          .getPool(token0, token1, fee)
          .call({}, 'latest');

        if (poolAddress === NULL_ADDRESS) {
          this.eventPools[
            this.getPoolIdentifier(srcAddress, destAddress, fee)
          ] = null;
        } else {
          pool = new UniswapV3EventPool(
            this.dexKey,
            this.network,
            this.dexHelper,
            this.logger,
            poolAddress,
            fee,
            token0,
            token1,
          );

          const newState = await pool.generateState(blockNumber);
          pool.setState(newState, blockNumber);
          this.dexHelper.blockManager.subscribeToLogs(
            pool,
            pool.addressesSubscribed,
            blockNumber,
          );

          this.eventPools[
            this.getPoolIdentifier(srcAddress, destAddress, fee)
          ] = pool;
        }
      } catch (e) {
        this.logger.error(
          `${this.dexKey}: Can not fetch pool address from factory: srcAddress=${srcAddress}, destAddress=${destAddress}, fee=${fee}`,
        );
        return null;
      }
    }
    return pool;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _srcToken = wrapETH(srcToken, this.network);
    const _destToken = wrapETH(destToken, this.network);

    const [_srcAddress, _destAddress] = this._getLoweredAddresses(
      _srcToken,
      _destToken,
    );

    if (_srcAddress === _destAddress) return [];

    const pools = (
      await Promise.all(
        this.supportedFees.map(async fee =>
          this.getPool(_srcAddress, _destAddress, fee, blockNumber),
        ),
      )
    ).filter(pool => pool);

    if (pools.length === 0) return [];

    return pools.map(pool =>
      this.getPoolIdentifier(_srcAddress, _destAddress, pool!.feeCode),
    );
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<UniswapV3Data>> {
    const _srcToken = wrapETH(srcToken, this.network);
    const _destToken = wrapETH(destToken, this.network);

    const [_srcAddress, _destAddress] = this._getLoweredAddresses(
      _srcToken,
      _destToken,
    );

    if (_srcAddress === _destAddress) return null;

    const selectedPools = await this._getPoolsFromIdentifiers(
      limitPools
        ? limitPools
        : await this.getPoolIdentifiers(
            _srcToken,
            _destToken,
            side,
            blockNumber,
          ),
      blockNumber,
    );

    if (selectedPools.length === 0) return null;

    const states = await Promise.all(
      selectedPools.map(async pool => {
        let state = pool.getState(blockNumber);
        if (state === null || !state.isValid) {
          state = await pool.generateState(blockNumber);
          pool.setState(state, blockNumber);
        }
        return state;
      }),
    );

    const unitAmount = getBigIntPow(
      side == SwapSide.BUY ? _destToken.decimals : _srcToken.decimals,
    );

    const _amounts = [unitAmount, ...amounts.slice(1)];

    const result: ExchangePrices<UniswapV3Data> = new Array(
      selectedPools.length,
    );

    for (const [i, pool] of selectedPools.entries()) {
      const state = states[i];

      const prices =
        side == SwapSide.SELL
          ? this._getSellOutputs(state, _amounts)
          : this._getBuyOutputs(state, _amounts);

      result[i] = {
        unit: prices[0],
        prices: [0n, ...prices.slice(1)],
        data: {
          fee: pool.feeCode,
        },
        poolIdentifier: this.getPoolIdentifier(
          pool.token0,
          pool.token1,
          pool.feeCode,
        ),
        exchange: this.dexKey,
        gasCost: UNISWAPV3_QUOTE_GASLIMIT,
        poolAddresses: [pool.poolAddress],
      };
    }
    return result;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { fee } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          fee: 'uint24',
          deadline: 'uint256',
          sqrtPriceLimitX96: 'uint160',
        },
      },
      {
        fee,
        deadline: this.getDeadline(),
        sqrtPriceLimitX96: 0,
      },
    );

    return {
      targetExchange: this.config.router,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? UniswapV3Functions.exactInputSingle
        : UniswapV3Functions.exactOutputSingle;
    const swapFunctionParams: UniswapV3Param =
      side === SwapSide.SELL
        ? {
            tokenIn: srcToken,
            tokenOut: destToken,
            fee: data.fee,
            recipient: this.augustusAddress,
            deadline: this.getDeadline(),
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            sqrtPriceLimitX96: '0',
          }
        : {
            tokenIn: srcToken,
            tokenOut: destToken,
            fee: data.fee,
            recipient: this.augustusAddress,
            deadline: this.getDeadline(),
            amountOut: destAmount,
            amountInMaximum: srcAmount,
            sqrtPriceLimitX96: '0',
          };
    const swapData = this.routerIface.encodeFunctionData(swapFunction, [
      swapFunctionParams,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.router,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!
    return [];
  }

  private async _getPoolsFromIdentifiers(
    poolIdentifiers: string[],
    blockNumber: number,
  ): Promise<UniswapV3EventPool[]> {
    const pools = await Promise.all(
      poolIdentifiers.map(async identifier => {
        const [, srcAddress, destAddress, fee] = identifier.split('_');
        return this.getPool(srcAddress, destAddress, BigInt(fee), blockNumber);
      }),
    );
    return pools.filter(pool => pool !== null) as UniswapV3EventPool[];
  }

  private _getLoweredAddresses(srcToken: Token, destToken: Token) {
    return [srcToken.address.toLowerCase(), destToken.address.toLowerCase()];
  }

  private _sortTokens(srcAddress: Address, destAddress: Address) {
    return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
  }

  private _toLowerForAllConfigAddresses() {
    // If new config property will be added, the TS will throw compile error
    const newConfig: DexParams = {
      router: this.config.router.toLowerCase(),
      factory: this.config.factory.toLowerCase(),
      supportedFees: this.config.supportedFees,
    };
    return newConfig;
  }

  private _getSellOutputs(
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
  ): bigint[] {
    return amounts.map(amount => {
      const [, amount1] = uniswapV3Math.querySwap(
        state,
        { ...state.ticks },
        // zeroForOne
        true,
        amount,
        TickMath.MIN_SQRT_RATIO + 1n,
      );

      return -amount1;
    });
  }

  private _getBuyOutputs(
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
  ): bigint[] {
    return [];
  }
}
