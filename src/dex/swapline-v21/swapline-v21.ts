import {AsyncOrSync} from 'ts-essentials';
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
import {SwapSide, Network} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import {getDexKeysWithNetwork} from '../../utils';
import {IDex} from '../../dex/idex';
import {IDexHelper} from '../../dex-helper/idex-helper';
import {SwaplineV21Data} from './types';
import {getLocalDeadlineAsFriendlyPlaceholder, SimpleExchange} from '../simple-exchange';
import {SwaplineV21Config, Adapters} from './config';
import {SwaplineV21EventPool} from './swapline-v21-pool';
import {Interface, JsonFragment} from "@ethersproject/abi";
import {SwapLineV21RouterFunctions, SwapLineV21RouterParam} from "../swapline-v21old/types";
import SwapLineV21RouterABI from "../../abi/swapline-v21/SwapLineV21Router.json";

const SWAPLINE_V2_1_ROUTER_ADDRESS: { [network: number]: Address } = {
  [Network.FANTOM]: '0x795bF60522F36244E4e51ed5522fE83Df4D3Bf9a',
  [Network.OPTIMISM]: '0x408ba8dea8b514cc24F81e72795FC3DdbcA8Dbb5',
  [Network.ARBITRUM]: '0x25b320A7C69e66515D7f6C044eC9AF49Fa1588BB',
};

export class SwaplineV21
  extends SimpleExchange
  implements IDex<SwaplineV21Data> {
  static dexKeys = ['swaplinev2.1'];
  protected routerAddress: string;
  exchangeRouterInterface: Interface;

  protected eventPools: SwaplineV21EventPool;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SwaplineV21Config);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);

    this.routerAddress =
      SWAPLINE_V2_1_ROUTER_ADDRESS[dexHelper.config.data.network];

    this.exchangeRouterInterface = new Interface(
      SwapLineV21RouterABI as JsonFragment[],
    );

    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new SwaplineV21EventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
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
    return [];
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
  ): Promise<null | ExchangePrices<SwaplineV21Data>> {
    // TODO: complete me!
    return null;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<SwaplineV21Data>,
  ): number | number[] {
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
    data: SwaplineV21Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    let payload = this.abiCoder.encodeParameters(
      ['tuple(tuple(uint256[],uint8[],address[]),uint256)'],
      [
        [
          [
            [
              data.binStep, // _pairBinSteps: uint256[]
            ],
            [
              2, // _versions: uint8[]
            ],
            [
              data.tokenIn,
              data.tokenOut, // _tokenPath: address[]
            ],
          ],
          getLocalDeadlineAsFriendlyPlaceholder(), // _deadline: uint256
        ],
      ],
    );

    return {
      targetExchange: this.routerAddress,
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
    data: SwaplineV21Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? SwapLineV21RouterFunctions.swapExactTokensForTokens
        : SwapLineV21RouterFunctions.swapTokensForExactTokens;

    const swapFunctionParams: SwapLineV21RouterParam =
      side === SwapSide.SELL
        ? [
          srcAmount,
          destAmount,
          [[data.binStep], ['2'], [srcToken, destToken]],
          this.augustusAddress,
          getLocalDeadlineAsFriendlyPlaceholder(),
        ]
        : [
          destAmount,
          srcAmount,
          [[data.binStep], ['2'], [srcToken, destToken]],
          this.augustusAddress,
          getLocalDeadlineAsFriendlyPlaceholder(),
        ];

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.routerAddress,
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
