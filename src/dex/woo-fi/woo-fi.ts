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
import { DexParams, PoolState, WooFiData } from './types';
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

  vaultUSDBalance: number = 0;

  tokenByAddress: Record<string, Token>;

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

    // Normalise once all config addresses and use across all scenarios
    this.config = this._toLowerForAllConfigAddresses();

    this.quoteTokenAddress = this.config.quoteToken.address;

    this.tokenByAddress = Object.values(this.baseTokens).reduce(
      (acc, cur) => {
        acc[cur.address] = cur;
        return acc;
      },
      { [this.quoteTokenAddress]: this.config.quoteToken },
    );
  }

  private _toLowerForAllConfigAddresses() {
    // If new config property will be added, the TS will throw compile error
    const newConfig: DexParams = {
      wooPPAddress: this.config.wooPPAddress.toLowerCase(),
      wooOracleAddress: this.config.wooPPAddress.toLowerCase(),
      wooFeeManagerAddress: this.config.wooPPAddress.toLowerCase(),
      quoteToken: {
        ...this.config.quoteToken,
        address: this.config.quoteToken.address.toLowerCase(),
      },
      baseTokens: Object.keys(this.config.baseTokens).reduce<
        Record<string, Token>
      >((acc, cur) => {
        const token = this.config.baseTokens[cur];
        token.address = token.address.toLowerCase();
        acc[cur] = token;
        return acc;
      }, {}),
    };
    return newConfig;
  }

  get baseTokens(): Token[] {
    return Object.values(this.config.baseTokens);
  }

  protected _fillTokenInfoState(
    state: PoolState,
    address: string,
    values: Result,
  ) {
    state.tokenInfos[address] = {
      reserve: BigInt(values.reserve._hex),
      R: BigInt(values.R._hex),
      threshold: BigInt(values.threshold._hex),
    };
  }

  protected _getStateRequestCallData() {
    if (this._encodedStateRequestCalldata === undefined) {
      const calldata = this.baseTokens
        .map(t => [
          {
            target: this.config.wooFeeManagerAddress,
            callData: WooFi.ifaces.fee.encodeFunctionData('feeRate', [
              t.address,
            ]),
          },
          {
            target: this.config.wooOracleAddress,
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

      calldata.push({
        target: this.config.wooPPAddress,
        callData: WooFi.ifaces.PP.encodeFunctionData('tokenInfo', [
          this.quoteTokenAddress,
        ]),
      });

      this._encodedStateRequestCalldata = calldata;
    }

    return this._encodedStateRequestCalldata;
  }

  async fetchStateForBlockNumber(blockNumber?: number): Promise<PoolState> {
    const calldata = this._getStateRequestCallData();

    const data = await this.dexHelper.multiContract.methods
      .aggregate(calldata.slice(0, 1))
      .call({}, blockNumber || 'latest');

    // Last request is standalone
    const maxNumber = calldata.length - 1;

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
      state.feeRates[this.baseTokens[index].address] = BigInt(value[0]._hex);
    });
    baseInfos.map((value, index) => {
      state.tokenStates[this.baseTokens[index].address] = {
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
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getIdentifier(isSrcQuote: boolean) {
    // Expected lower cased addresses
    // And checks if one of the tokens is quote already done outside
    return isSrcQuote ? `${this.dexKey}_qb` : `${this.dexKey}_bq`;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _srcToken = wrapETH(srcToken, this.network);
    const _destToken = wrapETH(destToken, this.network);
    _srcToken.address = _srcToken.address.toLowerCase();
    _destToken.address = _destToken.address.toLowerCase();

    if (
      !this.tokenByAddress[_srcToken.address] ||
      !this.tokenByAddress[_destToken.address]
    ) {
      return [];
    }

    const { isSrcQuote, isDestQuote } = this._identifyQuote(
      _srcToken.address,
      _destToken.address,
    );

    if (!isSrcQuote && !isDestQuote) return [];

    return [this.getIdentifier(isSrcQuote)];
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
      _srcToken.address = _srcToken.address.toLowerCase();
      _destToken.address = _destToken.address.toLowerCase();

      if (
        !this.tokenByAddress[_srcToken.address] ||
        !this.tokenByAddress[_destToken.address]
      )
        return null;

      const { isSrcQuote, isDestQuote } = this._identifyQuote(
        _srcToken.address,
        _destToken.address,
      );

      if (!isSrcQuote && !isDestQuote) return null;

      const expectedIdentifier = this.getIdentifier(isSrcQuote);
      if (
        limitPools === undefined ||
        !limitPools.some(p => p === expectedIdentifier)
      )
        return null;

      const unitVolume = getBigIntPow(_srcToken.decimals);

      const _amounts = [unitVolume, ...amounts.slice(1)];

      const state = await this.getState(blockNumber);

      let _prices: bigint[];
      if (isSrcQuote) {
        _prices = this.math.querySellQuote(
          state,
          this.quoteTokenAddress,
          _destToken.address,
          _amounts,
        );
      } else {
        _prices = this.math.querySellBase(
          state,
          this.quoteTokenAddress,
          _srcToken.address,
          _amounts,
        );
      }

      const unit = _prices[0];

      return [
        {
          unit,
          prices: [0n, ..._prices.slice(1)],
          data: {},
          poolIdentifier: expectedIdentifier,
          exchange: this.dexKey,
          gasCost: WOO_FI_GAS_COST,
          poolAddresses: [this.config.wooPPAddress],
        },
      ];
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
      targetExchange: this.config.wooPPAddress,
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
      this.config.wooPPAddress,
    );
  }

  async updatePoolState(): Promise<void> {
    const state = await this.getState();

    const tokenBalancesUSD = await Promise.all(
      Object.values(this.tokenByAddress).map(t =>
        this.dexHelper.getTokenUSDPrice(t, state.tokenInfos[t.address].reserve),
      ),
    );
    this.vaultUSDBalance = tokenBalancesUSD.reduce(
      (sum: number, curr: number) => sum + curr,
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

    if (!this.tokenByAddress[wrappedTokenAddress]) return [];
    if (!this.latestState) return [];

    const connectorTokens =
      wrappedTokenAddress === this.quoteTokenAddress
        ? this.baseTokens
        : [this.tokenByAddress[this.quoteTokenAddress]];

    return [
      {
        exchange: this.dexKey,
        address: this.config.wooPPAddress,
        connectorTokens,
        liquidityUSD: this.vaultUSDBalance,
      },
    ];
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

  private _identifyQuote(srcAddress: Address, destAddress: Address) {
    return {
      isSrcQuote: srcAddress === this.quoteTokenAddress,
      isDestQuote: destAddress === this.quoteTokenAddress,
    };
  }
}
