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

  readonly wooIfaces = {
    PP: new Interface(wooPPABI),
    fee: new Interface(wooFeeManagerABI),
    oracle: new Interface(woOracleABI),
  };

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  private _exchangeAddress?: string;

  private _oracleAddress?: string;

  private _quoteTokenAddress?: string;

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
  }

  get baseTokens(): Token[] {
    return Object.values(this.config.baseTokens);
  }

  get exchangeAddress() {
    if (this._exchangeAddress === undefined) {
      this._exchangeAddress = this.config.wooPPAddress.toLowerCase();
    }
    return this._exchangeAddress;
  }

  get oracleAddress() {
    if (this._oracleAddress === undefined) {
      this._oracleAddress = this.config.woOracleAddress.toLowerCase();
    }
    return this._oracleAddress;
  }

  get quoteTokenAddress() {
    if (this._quoteTokenAddress === undefined) {
      this._quoteTokenAddress = this.config.quoteToken.address.toLowerCase();
    }
    return this._quoteTokenAddress;
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

  async fetchStateForBlockNumber(blockNumber?: number): Promise<PoolState> {
    const calldata = _.flattenDeep(
      this.baseTokens.map(t => [
        {
          target: this.config.wooFeeManagerAddress,
          callData: this.wooIfaces.fee.encodeFunctionData('feeRate', [
            t.address,
          ]),
        },
        {
          target: this.config.woOracleAddress,
          callData: this.wooIfaces.oracle.encodeFunctionData('infos', [
            t.address,
          ]),
        },
        {
          target: this.config.wooPPAddress,
          callData: this.wooIfaces.PP.encodeFunctionData('tokenInfo', [
            t.address,
          ]),
        },
      ]),
    );

    calldata.push({
      target: this.config.wooPPAddress,
      callData: this.wooIfaces.PP.encodeFunctionData('tokenInfo', [
        this.quoteTokenAddress,
      ]),
    });

    const data = await this.dexHelper.multiContract.methods
      .aggregate(calldata)
      .call({}, blockNumber || 'latest');

    // Last request is standalone
    const maxNumber = calldata.length - 1;

    const [baseFeeRates, baseInfos, baseTokenInfos, quoteTokenInfo] = [
      // Skip two as they are infos abd tokenInfo
      _.range(0, maxNumber, 3).map(index =>
        this.wooIfaces.fee.decodeFunctionResult(
          'feeRate',
          data.returnData[index],
        ),
      ),
      _.range(1, maxNumber, 3).map(index =>
        this.wooIfaces.oracle.decodeFunctionResult(
          'infos',
          data.returnData[index],
        ),
      ),
      _.range(2, maxNumber, 3).map(index =>
        this.wooIfaces.PP.decodeFunctionResult(
          'tokenInfo',
          data.returnData[index],
        ),
      ),
      this.wooIfaces.PP.decodeFunctionResult(
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

  static getIdentifier(dexKey: string, baseTokenAddress: string) {
    // quoteToken is always the same, so I think baseToken address is sufficient
    // for identifier
    return `${dexKey.toLowerCase()}_${baseTokenAddress.toLowerCase()}`;
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
      : [WooFi.getIdentifier(this.dexKey, baseToken.address)];
  }

  getBaseFromIdentifier(identifier: string) {
    if (this.tokenByAddress === null)
      throw new Error(
        'tokenByAddress was not properly initialized. Check if initializePricing was called',
      );

    const baseTokenAddress = identifier.split('_')[1];
    return this.tokenByAddress[baseTokenAddress.toLowerCase()];
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

      // Because of all pools are made in the form of: baseToken / quoteToken
      // where quoteToken is always the same, the difference only in baseToken.
      const allowedPairIdentifiers =
        limitPools !== undefined
          ? this.baseTokens
              .map(token => WooFi.getIdentifier(this.dexKey, token.address))
              .filter(identifier => limitPools.includes(identifier))
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
        const baseToken = this.getBaseFromIdentifier(allowedPairIdentifier);

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
          poolIdentifier: WooFi.getIdentifier(this.dexKey, baseToken.address),
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

    const swapData = this.wooIfaces.PP.encodeFunctionData(funcName, [
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

    // If we knew current blockNumber, we wouldn't need to fetch the state
    // each time we query this function
    const state = await this.fetchStateForBlockNumber();

    return (
      selected
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
        // Sorting done before slicing because the number of tokens is very small
        // And its not expected to increase much
        .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
        .slice(0, limit)
    );
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

  async getState(blockNumber: number): Promise<PoolState> {
    if (this.latestBlockNumber === blockNumber && this.latestState !== null) {
      return this.latestState;
    }
    this.latestState = await this.fetchStateForBlockNumber(blockNumber);
    this.latestBlockNumber = blockNumber;
    return this.latestState;
  }
}
