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
import { IdleDaoData, Param, PoolFunctions } from './types';
import { SimpleExchange } from '../simple-exchange';
import { Config, Adapters } from './config';
// import { IdleDaoEventPool } from './idle-dao-pool';
import { fetchTokenList } from './utils';
import { getIdleTokenIfIdleDaoPair, setTokensOnNetwork } from './tokens';
import FACTORY_ABI from '../../abi/idle-dao/idle-cdo-factory.json';
import CDO_ABI from '../../abi/idle-dao/idle-cdo.json';

const REF_CODE = '0x0000000000000000000000000000000000000000';
export const TOKEN_LIST_CACHE_KEY = 'token-list';
const TOKEN_LIST_TTL_SECONDS = 24 * 60 * 60;
const TOKEN_LIST_LOCAL_TTL_SECONDS = 3 * 60 * 60;

export class IdleDao extends SimpleExchange implements IDex<IdleDaoData> {
  // protected eventPools: IdleDaoEventPool;

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
    /*
    this.eventPools = new IdleDaoEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
    */
    this.cdo = new Interface(CDO_ABI);
    this.factory = new Interface(FACTORY_ABI);
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
      setTokensOnNetwork(this.network, JSON.parse(cachedTokenList));
      return;
    }

    let tokenList = await fetchTokenList(
      this.dexHelper.web3Provider,
      blockNumber,
      this.config.fromBlock,
      this.config.factoryAddress,
      this.cdo,
      this.erc20Interface,
      this.dexHelper.multiWrapper,
    );

    // console.log('tokenList', tokenList);

    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      TOKEN_LIST_CACHE_KEY,
      TOKEN_LIST_TTL_SECONDS,
      JSON.stringify(tokenList),
    );

    setTokensOnNetwork(this.network, tokenList);
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
    const _src = this.dexHelper.config.wrapETH(srcToken);
    const _dst = this.dexHelper.config.wrapETH(destToken);

    // Look for idleToken
    const idleToken = getIdleTokenIfIdleDaoPair(this.network, _src, _dst);

    if (!idleToken) return null;

    const fromIdleToken =
      idleToken.idleAddress.toLowerCase() == _src.address.toLowerCase();

    return [
      {
        prices: amounts,
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

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IdleDaoData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const amount = side === SwapSide.SELL ? srcAmount : destAmount;
    const [Interface, swapCallee, swapFunction, swapFunctionParams] = ((): [
      Interface,
      Address,
      PoolFunctions,
      Param,
    ] => {
      if (data.fromIdleToken)
        return [
          this.cdo,
          data.idleToken.cdoAddress,
          PoolFunctions[`withdraw${data.idleToken.tokenType}`],
          [amount],
        ];

      return [
        this.cdo,
        data.idleToken.cdoAddress,
        PoolFunctions[`deposit${data.idleToken.tokenType}`],
        [amount, REF_CODE],
      ];
    })();

    const swapData = Interface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      amount,
      destToken,
      destAmount,
      swapData,
      swapCallee,
    );
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
}
