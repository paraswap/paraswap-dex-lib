import { AsyncOrSync } from 'ts-essentials';
import { Interface } from '@ethersproject/abi';
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
import { SwapSide, Network, NULL_ADDRESS } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork, isETHAddress, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  IdleDaoData,
  Param,
  PoolFunctions,
  IdleToken,
  PoolState,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { Config, Adapters } from './config';
import { IdleDaoEventPool } from './idle-dao-pool';
import { fetchTokenList } from './utils';
import {
  getIdleTokenIfIdleDaoPair,
  setTokensOnNetwork,
  getPoolsByTokenAddress,
  getTokenFromIdleToken,
} from './tokens';
import FACTORY_ABI from '../../abi/idle-dao/idle-cdo-factory.json';
import CDO_ABI from '../../abi/idle-dao/idle-cdo.json';

export const TOKEN_LIST_CACHE_KEY = 'token-list';
const TOKEN_LIST_TTL_SECONDS = 24 * 60 * 60;
const TOKEN_LIST_LOCAL_TTL_SECONDS = 3 * 60 * 60;

export class IdleDao extends SimpleExchange implements IDex<IdleDaoData> {
  protected eventPools: Record<string, IdleDaoEventPool> = {};

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(Config);

  logger: Logger;

  private cdo: Interface;
  private factory: Interface;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected config = Config[dexKey][network],
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.cdo = new Interface(CDO_ABI);
    this.factory = new Interface(FACTORY_ABI);
  }

  getEventPool(idleAddress: string): IdleDaoEventPool | null {
    return this.eventPools[idleAddress] || null;
  }

  async setupEventPool(
    idleToken: IdleToken,
    blockNumber: number,
  ): Promise<IdleDaoEventPool> {
    const idleDaoEventPool = new IdleDaoEventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
      idleToken,
    );

    // this.logger.debug("idleDaoEventPool registered ", idleToken.idleAddress)

    this.eventPools[idleToken.idleAddress] = idleDaoEventPool;

    // Generate first state for the blockNumber and subscribe to logs
    await idleDaoEventPool.initialize(blockNumber);
    return idleDaoEventPool;
  }

  async getTokensList(blockNumber: number): Promise<Record<string, IdleToken>> {
    const tokenList = await fetchTokenList(
      this.dexHelper.web3Provider,
      blockNumber,
      this.config.fromBlock,
      this.config.factoryAddress,
      this.cdo,
      this.erc20Interface,
      this.dexHelper.multiWrapper,
    );

    return tokenList.reduce(
      (acc: Record<string, IdleToken>, idleToken: IdleToken) => {
        return {
          ...acc,
          [idleToken.idleAddress]: idleToken,
        };
      },
      {},
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    let cachedTokenList = await this.dexHelper.cache.getAndCacheLocally(
      this.dexKey,
      this.network,
      TOKEN_LIST_CACHE_KEY,
      TOKEN_LIST_LOCAL_TTL_SECONDS,
    );
    if (cachedTokenList !== null) {
      const tokens: IdleToken[] = JSON.parse(cachedTokenList);
      const networkTokens = setTokensOnNetwork(this.network, tokens);

      await Promise.all(
        tokens.map((idleToken: IdleToken) =>
          this.setupEventPool(idleToken, blockNumber),
        ),
      );
      return;
    }

    const tokenList = await fetchTokenList(
      this.dexHelper.web3Provider,
      blockNumber,
      this.config.fromBlock,
      this.config.factoryAddress,
      this.cdo,
      this.erc20Interface,
      this.dexHelper.multiWrapper,
    );

    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      TOKEN_LIST_CACHE_KEY,
      TOKEN_LIST_TTL_SECONDS,
      JSON.stringify(tokenList),
    );

    const networkTokens = setTokensOnNetwork(this.network, tokenList);

    await Promise.all(
      tokenList.map((idleToken: IdleToken) =>
        this.setupEventPool(idleToken, blockNumber),
      ),
    );
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  private _getPoolIdentifier(srcToken: Token, destToken: Token): string {
    return (
      this.dexKey +
      [srcToken.address.toLowerCase(), destToken.address.toLowerCase()]
        .sort((a, b) => (a > b ? 1 : -1))
        .join('_')
    );
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
    const idleToken = getIdleTokenIfIdleDaoPair(
      this.network,
      this.dexHelper.config.wrapETH(srcToken),
      this.dexHelper.config.wrapETH(destToken),
    );

    if (idleToken === null) return [];

    return [this._getPoolIdentifier(srcToken, destToken)];
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
  ): Promise<null | ExchangePrices<IdleDaoData>> {
    try {
      const _src = this.dexHelper.config.wrapETH(srcToken);
      const _dst = this.dexHelper.config.wrapETH(destToken);

      // Look for idleToken
      const idleToken = getIdleTokenIfIdleDaoPair(this.network, _src, _dst);
      if (!idleToken) {
        // console.log('IdleToken NOT FOUND -', blockNumber, this.network, _src, _dst)
        return null;
      }

      const fromIdleToken =
        idleToken.idleAddress.toLowerCase() == _src.address.toLowerCase();

      // Cannot buy with IdleTokens
      // if (fromIdleToken && side === SwapSide.BUY) return null

      const eventPool: IdleDaoEventPool =
        this.eventPools[idleToken.idleAddress];
      const eventPoolState: PoolState | null = eventPool.getState(blockNumber);

      this.logger.debug(
        'eventPoolState',
        blockNumber,
        idleToken.idleAddress,
        eventPoolState,
      );

      if (!eventPoolState) {
        // console.log('eventPoolState is NULL -', blockNumber, idleToken.idleAddress, eventPoolState)
        return null;
      }

      const tokenPrice = eventPoolState.tokenPrice;

      const unitVolume = getBigIntPow(
        (side === SwapSide.SELL ? srcToken : destToken).decimals,
      );

      const prices = [unitVolume, ...amounts].map((amount: bigint) => {
        let output = 0;
        if (side === SwapSide.SELL) {
          // SELL idleToken (amount = 1000000000000000000 AA_idle_cpPOR-USDC, output = 1000000000000000000*tokenPrice/1e18)
          if (fromIdleToken) {
            output = Math.round(
              (parseFloat('' + tokenPrice) * parseFloat('' + amount)) /
                parseFloat(`1e${idleToken.decimals}`),
            );
            // SELL underlyingToken (amount = 1000000 USDC), output = 1000000/tokenPrice*1e18
          } else {
            output = Math.round(
              (parseFloat('' + amount) / parseFloat('' + tokenPrice)) *
                parseFloat(`1e${idleToken.decimals}`),
            );
          }
        } else {
          // BUY idleToken (amount = 1000000 USDC, output = 1000000/tokenPrice*1e18)
          if (fromIdleToken) {
            output = Math.round(
              (parseFloat('' + amount) / parseFloat('' + tokenPrice)) *
                parseFloat(`1e${idleToken.decimals}`),
            );
            // BUY underlyingToken (amount = 1000000000000000000 AA_idle_cpPOR-USDC, output = 1000000000000000000*tokenPrice/1e18)
          } else {
            output = Math.round(
              (parseFloat('' + tokenPrice) * parseFloat('' + amount)) /
                parseFloat(`1e${idleToken.decimals}`),
            );
          }
        }
        return BigInt(output);
      });

      // console.log('getPricesVolume', srcToken.address, destToken.address, fromIdleToken, side, unitVolume, amounts, prices)

      // const unit = side === SwapSide.SELL ? prices[0] : unitVolume;

      return [
        {
          unit: prices[0],
          prices: prices.slice(1),
          gasCost: this.config.lendingGasCost,
          exchange: this.dexKey,
          data: {
            idleToken,
            fromIdleToken,
          },
          poolAddresses: [fromIdleToken ? srcToken.address : destToken.address],
        },
      ];
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }

  async getPricesVolume_old(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<IdleDaoData>> {
    try {
      const _src = this.dexHelper.config.wrapETH(srcToken);
      const _dst = this.dexHelper.config.wrapETH(destToken);

      // Look for idleToken
      const idleToken = getIdleTokenIfIdleDaoPair(this.network, _src, _dst);
      if (!idleToken) {
        // console.log('IdleToken NOT FOUND -', blockNumber, this.network, _src, _dst)
        return null;
      }

      const fromIdleToken =
        idleToken.idleAddress.toLowerCase() == _src.address.toLowerCase();

      const eventPool: IdleDaoEventPool =
        this.eventPools[idleToken.idleAddress];
      const eventPoolState: PoolState | null = eventPool.getState(blockNumber);

      this.logger.debug(
        'eventPoolState',
        blockNumber,
        idleToken.idleAddress,
        eventPoolState,
      );

      if (!eventPoolState) {
        // console.log('eventPoolState is NULL -', blockNumber, idleToken.idleAddress, eventPoolState)
        return null;
      }

      const prices = amounts.map((amount: bigint) => {
        let tokenPrice = null;
        if (fromIdleToken) {
          tokenPrice = eventPoolState.tokenPrice;
        } else {
          tokenPrice = BigInt(
            Math.round(
              (parseFloat(`1e${srcToken.decimals}`) /
                parseFloat('' + eventPoolState.tokenPrice)) *
                parseFloat(`1e${srcToken.decimals}`),
            ),
          );
        }

        const destAmount = Math.round(
          (parseFloat('' + tokenPrice) * parseFloat('' + amount)) /
            parseFloat(`1e${srcToken.decimals}`),
        );

        const decimalsDiff = destToken.decimals - srcToken.decimals;
        let destAmountBigInt = BigInt(0);
        if (decimalsDiff > 0) {
          destAmountBigInt = BigInt(
            Math.round(destAmount * parseFloat(`1e${decimalsDiff}`)),
          );
          // } else if (decimalsDiff<0){
          //   destAmountBigInt = BigInt(Math.round(destAmount/parseFloat(`1e${Math.abs(decimalsDiff)}`)))
        } else {
          destAmountBigInt = BigInt(destAmount);
        }
        // const destAmountBigInt = BigInt(destAmount)

        // console.log('getPricesVolume', srcToken, destToken, fromIdleToken, ''+amount, ''+tokenPrice, destAmount, ''+destAmountBigInt)
        return destAmountBigInt;
      });

      return [
        {
          prices,
          unit: getBigIntPow(
            (side === SwapSide.SELL ? destToken : srcToken).decimals,
          ),
          gasCost: this.config.lendingGasCost,
          exchange: this.dexKey,
          data: {
            idleToken,
            fromIdleToken,
          },
          poolAddresses: [fromIdleToken ? srcToken.address : destToken.address],
        },
      ];
    } catch (e) {
      // console.log('getPricesVolume - ERROR', srcToken, destToken, e);
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<IdleDaoData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IdleDaoData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const idleToken = data.fromIdleToken ? srcToken : destToken; // Warning
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          idleToken: 'address',
        },
      },
      { idleToken },
    );

    return {
      // target exchange is not used by the contract
      targetExchange: NULL_ADDRESS,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IdleDaoData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const [Interface, swapCallee, swapFunction, swapFunctionParams] = ((): [
      Interface,
      Address,
      PoolFunctions,
      Param,
    ] => {
      if (data.fromIdleToken) {
        return [
          this.cdo,
          data.idleToken.cdoAddress,
          PoolFunctions[`withdraw${data.idleToken.tokenType}`],
          [srcAmount],
        ];
      }

      return [
        this.cdo,
        data.idleToken.cdoAddress,
        PoolFunctions[`deposit${data.idleToken.tokenType}`],
        [srcAmount, this.augustusAddress],
      ];
    })();

    const swapData = Interface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      swapCallee,
    );
  }

  async updatePoolState(): Promise<void> {
    return Promise.resolve();
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const idleTokens: IdleToken[] = getPoolsByTokenAddress(tokenAddress);

    return idleTokens
      .map((idleToken: IdleToken, i) => ({
        liquidityUSD: 0,
        exchange: this.dexKey,
        address: idleToken.idleAddress,
        connectorTokens: [getTokenFromIdleToken(idleToken)],
      }))
      .slice(0, limit);
  }
}
