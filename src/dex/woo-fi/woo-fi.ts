import _ from 'lodash';
import { Interface, Result } from '@ethersproject/abi';
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
import { PoolState, WooFiData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { WooFiConfig, Adapters } from './config';
import { wooFiMath } from './woo-fi-math';
import {
  MIN_CONVERSION_RATE,
  USD_PRECISION,
  WOO_FI_GAS_COST,
} from './constants';
import wooPPABI from '../../abi/woo-fi/WooPP.abi.json';
import wooFeeManagerABI from '../../abi/woo-fi/WooFeeManager.abi.json';
import woOracleABI from '../../abi/woo-fi/Wooracle.abi.json';

export class WooFi extends SimpleExchange implements IDex<WooFiData> {
  readonly math: typeof wooFiMath = wooFiMath;

  latestState: PoolState | null = null;

  latestBlockNumber: number = 0;

  tokenByAddress: Record<string, Token> | null = null;

  private _encodedStateRequestCalldata?: {
    target: Address;
    callData: string;
  }[];

  static readonly ifaces = {
    PP: new Interface(wooPPABI),
    fee: new Interface(wooFeeManagerABI),
    oracle: new Interface(woOracleABI),
  };

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  private readonly exchangeAddress: Address;
  private readonly quoteTokenAddress: Address;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(WooFiConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly config = WooFiConfig[dexKey][network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.exchangeAddress = this.config.wooPPAddress.toLowerCase();
    this.quoteTokenAddress = this.config.quoteToken.address.toLowerCase();
  }

  get baseTokens(): Token[] {
    return Object.values(this.config.baseTokens);
  }

  protected _fillTokenInfoState(
    state: PoolState,
    address: string,
    values: Result,
  ) {
    state.tokenInfos[address.toLowerCase()] = {
      reserve: BigInt(values.reserve._hex),
      R: BigInt(values.R._hex),
      threshold: BigInt(values.threshold._hex),
    };
  }

  protected _getStateRequestCallData() {
    if (this._encodedStateRequestCalldata === undefined) {
      const callData = this.baseTokens
        .map(t => [
          {
            target: this.config.wooFeeManagerAddress,
            callData: WooFi.ifaces.fee.encodeFunctionData('feeRate', [
              t.address,
            ]),
          },
          {
            target: this.config.woOracleAddress,
            callData: WooFi.ifaces.oracle.encodeFunctionData('infos', [
              t.address,
            ]),
          },
          {
            target: this.config.wooPPAddress,
            callData: WooFi.ifaces.PP.encodeFunctionData('tokenInfo', [
              t.address,
            ]),
          },
        ])
        .flat();

      callData.push({
        target: this.config.wooPPAddress,
        callData: WooFi.ifaces.PP.encodeFunctionData('tokenInfo', [
          this.quoteTokenAddress,
        ]),
      });

      this._encodedStateRequestCalldata = callData;
    }

    return this._encodedStateRequestCalldata;
  }

  async fetchStateForBlockNumber(blockNumber?: number): Promise<PoolState> {
    const callData = this._getStateRequestCallData();

    const data = await this.dexHelper.multiContract.methods
      .aggregate(callData)
      .call({}, blockNumber || 'latest');

    // Last request is standalone
    const maxNumber = callData.length - 1;

    const [baseFeeRates, baseInfos, baseTokenInfos, quoteTokenInfo] = [
      // Skip two as they are infos abd tokenInfo
      _.range(0, maxNumber, 3).map(index =>
        WooFi.ifaces.fee.decodeFunctionResult(
          'feeRate',
          data.returnData[index],
        ),
      ),
      _.range(1, maxNumber, 3).map(index =>
        WooFi.ifaces.oracle.decodeFunctionResult(
          'infos',
          data.returnData[index],
        ),
      ),
      _.range(2, maxNumber, 3).map(index =>
        WooFi.ifaces.PP.decodeFunctionResult(
          'tokenInfo',
          data.returnData[index],
        ),
      ),
      WooFi.ifaces.PP.decodeFunctionResult(
        'tokenInfo',
        data.returnData[maxNumber],
      ),
    ];

    const state: PoolState = {
      feeRates: {},
      tokenInfos: {},
      tokenStates: {},
    };
    this._fillTokenInfoState(state, this.quoteTokenAddress, quoteTokenInfo);

    baseFeeRates.map((value, index) => {
      const tokenAddress = this.baseTokens[index].address.toLowerCase();
      state.feeRates[tokenAddress] = BigInt(value[0]._hex);
    });
    baseInfos.map((value, index) => {
      const tokenAddress = this.baseTokens[index].address.toLowerCase();
      state.tokenStates[tokenAddress] = {
        priceNow: BigInt(value.price._hex),
        coeffNow: BigInt(value.coeff._hex),
        spreadNow: BigInt(value.spread._hex),
      };
    });
    baseTokenInfos.map((values, index) => {
      this._fillTokenInfoState(state, this.baseTokens[index].address, values);
    });

    return state;
  }

  async initializePricing(blockNumber: number) {
    this.latestState = await this.fetchStateForBlockNumber(blockNumber);
    this.latestBlockNumber = blockNumber;

    this.tokenByAddress = {};

    // Normalising to toLowerCase()
    this.config.quoteToken.address = this.quoteTokenAddress;
    this.tokenByAddress[this.quoteTokenAddress] = this.config.quoteToken;

    for (const baseToken of this.baseTokens) {
      const baseTokenAddress = baseToken.address.toLowerCase();
      baseToken.address = baseTokenAddress;
      this.tokenByAddress[baseTokenAddress] = baseToken;
    }
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getIdentifier(srcToken: Address, destToken: Address) {
    if (srcToken.toLowerCase() === this.quoteTokenAddress) {
      return `${this.dexKey.toLowerCase()}_qb`;
    } else if (destToken.toLowerCase() === this.quoteTokenAddress) {
      return `${this.dexKey.toLowerCase()}_bq`;
    } else {
      throw new Error(
        'srcToken or destToken must be equal to quoteTokenAddress',
      );
    }
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _srcToken = wrapETH(srcToken, this.network);
    const _destToken = wrapETH(destToken, this.network);

    if (_srcToken.address.toLowerCase() === _destToken.address.toLowerCase()) {
      return [];
    }

    let tokenToSearch: string;
    if (_srcToken.address.toLowerCase() === this.quoteTokenAddress) {
      tokenToSearch = _destToken.address.toLowerCase();
    } else if (_destToken.address.toLowerCase() === this.quoteTokenAddress) {
      tokenToSearch = _srcToken.address.toLowerCase();
    } else {
      return [];
    }
    const baseToken = this.baseTokens.find(
      token => token.address.toLowerCase() === tokenToSearch,
    );
    return baseToken === undefined
      ? []
      : [this.getIdentifier(_srcToken.address, _destToken.address)];
  }

  getBaseFromIdentifier(
    identifier: string,
    srcToken: Address,
    destToken: Address,
  ) {
    if (this.tokenByAddress === null)
      throw new Error(
        'tokenByAddress was not properly initialized. Check if initializePricing was called',
      );

    const direction = identifier.split('_')[1];
    if (direction === 'bq') {
      return this.tokenByAddress[srcToken.toLowerCase()];
    } else if (direction === 'qb') {
      return this.tokenByAddress[destToken.toLowerCase()];
    } else {
      throw new Error(
        `direction in getBaseFromIdentifier must be 'bq' or 'qb'`,
      );
    }
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<WooFiData>> {
    if (side === SwapSide.BUY) return null;

    try {
      const _srcToken = wrapETH(srcToken, this.network);
      const _destToken = wrapETH(destToken, this.network);

      if (
        _srcToken.address.toLowerCase() === _destToken.address.toLowerCase()
      ) {
        return null;
      }

      const expectedIdentifier = this.getIdentifier(
        _srcToken.address,
        _destToken.address,
      );
      const allowedPairIdentifiers =
        limitPools !== undefined
          ? limitPools.filter(
              limitIdentifier => limitIdentifier === expectedIdentifier,
            )
          : await this.getPoolIdentifiers(
              _srcToken,
              _destToken,
              side,
              blockNumber,
            );

      if (!allowedPairIdentifiers.length) return null;

      const unitVolume = getBigIntPow(_srcToken.decimals);

      const _amounts = [unitVolume, ...amounts.slice(1)];

      const state = await this.getState(blockNumber);

      const result: ExchangePrices<WooFiData> = [];
      for (const allowedPairIdentifier of allowedPairIdentifiers) {
        const baseToken = this.getBaseFromIdentifier(
          allowedPairIdentifier,
          _srcToken.address,
          _destToken.address,
        );

        const _prices: bigint[] = [];
        for (const _amount of _amounts) {
          if (_amount === 0n) {
            _prices.push(_amount);
          } else {
            if (_srcToken.address.toLowerCase() === this.quoteTokenAddress) {
              _prices.push(
                this.math.querySellQuote(
                  state,
                  this.quoteTokenAddress,
                  baseToken.address,
                  _amount,
                ),
              );
            } else if (
              _destToken.address.toLowerCase() === this.quoteTokenAddress
            ) {
              _prices.push(
                this.math.querySellBase(
                  state,
                  this.quoteTokenAddress,
                  baseToken.address,
                  _amount,
                ),
              );
            } else {
              // One of them must be quoteToken
              return null;
            }
          }
        }

        const unit = _prices[0];

        result.push({
          unit,
          prices: [0n, ..._prices.slice(1)],
          data: {},
          poolIdentifier: allowedPairIdentifier,
          exchange: this.dexKey,
          gasCost: WOO_FI_GAS_COST,
          poolAddresses: [this.exchangeAddress],
        });
      }
      return result;
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WooFiData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    return {
      targetExchange: this.exchangeAddress,
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WooFiData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const _srcToken = srcToken.toLowerCase();
    const _destToken = destToken.toLowerCase();

    let funcName: string;
    let _amount: string;
    let baseToken: string;
    if (_srcToken === this.quoteTokenAddress) {
      baseToken = _destToken;
      funcName = 'sellQuote';
      _amount = srcAmount;
    } else if (_destToken === this.quoteTokenAddress) {
      baseToken = _srcToken;
      funcName = 'sellBase';
      _amount = srcAmount;
    } else {
      throw new Error(
        `srcToken ${srcToken} or destToken ${destToken} must be quoteToken`,
      );
    }

    const swapData = WooFi.ifaces.PP.encodeFunctionData(funcName, [
      baseToken, // baseToken
      _amount, // amount
      MIN_CONVERSION_RATE, // minAmount
      this.augustusAddress, // to
      NULL_ADDRESS, // rebateTo
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.exchangeAddress,
    );
  }

  async updatePoolState(): Promise<void> {
    await this.getState();
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const wrappedTokenAddress = wrapETH(
      { address: tokenAddress, decimals: 0 },
      this.network,
    ).address.toLowerCase();

    const filteredToken = Object.values(this.tokenByAddress!).filter(
      token => token.address === wrappedTokenAddress,
    );

    if (filteredToken.length === 0) return [];

    const selected =
      wrappedTokenAddress === this.quoteTokenAddress
        ? this.baseTokens
        : [this.tokenByAddress![this.quoteTokenAddress]];

    // Assuming that updatePoolState was called right before current function
    // and block number didn't change
    const state = this.latestState ? this.latestState : await this.getState();

    return selected
      .map(token => {
        const loweredTokenAddress = token.address.toLowerCase();

        let liquidityBigInt: bigint;

        // If currentToken is quote, it means we want to sellQuote and buy baseToken.
        // To calculate liquidity, we need to convert baseReserve to quote and use that value
        if (this._isQuote(loweredTokenAddress)) {
          const baseReserve = state.tokenInfos[wrappedTokenAddress].reserve;
          liquidityBigInt = this.math.querySellBase(
            state,
            loweredTokenAddress,
            wrappedTokenAddress,
            baseReserve,
          );
        } else {
          // If current token is the base, we just use the reserve of quote as liquidity
          liquidityBigInt = state.tokenInfos[loweredTokenAddress].reserve;
        }

        const liquidityUSD = this._bigIntToNumberWithPrecision(
          liquidityBigInt,
          this.config.quoteToken.decimals,
          USD_PRECISION,
        );

        return {
          exchange: this.dexKey,
          address: this.exchangeAddress,
          connectorTokens: [token],
          liquidityUSD,
        };
      })
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }

  private _isQuote(a: string): boolean {
    return this.quoteTokenAddress === a.toLowerCase();
  }

  // I think this function is quite strange. Is there more simple way to achieve the same?
  // I want to convert bigint to number and keep the precision
  private _bigIntToNumberWithPrecision(
    value: bigint,
    decimals: number,
    precision: number = 2,
  ) {
    if (precision > decimals)
      throw new Error(
        `precision ${precision} must be <= decimals ${decimals} in _convertToNumberWithPrecision`,
      );

    const slashed = (value / getBigIntPow(decimals - precision)).toString();

    const indToInt = slashed.length - precision;
    return (
      Number(slashed.slice(0, indToInt)) +
      Number(`0.${slashed.slice(indToInt, slashed.length)}`)
    );
  }

  async getState(blockNumber?: number): Promise<PoolState> {
    if (
      blockNumber !== undefined &&
      this.latestBlockNumber === blockNumber &&
      this.latestState !== null
    ) {
      return this.latestState;
    }
    this.latestState = await this.fetchStateForBlockNumber(blockNumber);
    this.latestBlockNumber = blockNumber ? blockNumber : 0;
    return this.latestState;
  }
}
