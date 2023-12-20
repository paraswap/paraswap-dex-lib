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
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  TraderJoeV2RouterFunctions,
  TraderJoeV2RouterParam,
  TraderJoeV2_1Data,
} from './types';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';
import { Adapters, TraderJoeV2_1Config } from './config';
import { TraderJoeV2_1EventPool } from './trader-joe-v2-1-2-pool';
import { Interface, JsonFragment } from '@ethersproject/abi';
import TraderJoeV21RouterABI from '../../abi/TraderJoeV21Router.json';
import { SUPPORTED_BIN_STEPS } from './constants';

export class TraderJoeV2_1
  extends SimpleExchange
  implements IDex<TraderJoeV2_1Data>
{
  // protected eventPools: TraderJoeV2_1EventPool;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  exchangeRouterInterface: Interface;

  factoryAddress: string;
  routerAddress: string;

  readonly eventPools: Record<string, TraderJoeV2_1EventPool | null> = {};

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(TraderJoeV2_1Config);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    const config = TraderJoeV2_1Config[dexKey];
    // this.eventPools = new TraderJoeV2_1EventPool(
    //   dexKey,
    //   network,
    //   dexHelper,
    //   this.logger,
    // );
    this.routerAddress = config[network].routerAddress;
    this.factoryAddress = config[network].factoryAddress;

    this.exchangeRouterInterface = new Interface(
      TraderJoeV21RouterABI as JsonFragment[],
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

  // TODO: Get it from the factory
  get supportedBinSteps() {
    return SUPPORTED_BIN_STEPS;
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
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    const [_srcAddress, _destAddress] = this._getLoweredAddresses(
      _srcToken,
      _destToken,
    );

    if (_srcAddress === _destAddress) return [];

    const pools = (
      await Promise.all(
        this.supportedBinSteps.map(async binStep =>
          this.getPool(_srcAddress, _destAddress, binStep, blockNumber),
        ),
      )
    ).filter(pool => pool);

    if (pools.length === 0) return [];

    return pools.map(pool =>
      this.getPoolIdentifier(_srcAddress, _destAddress, pool!.binStep),
    );
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<TraderJoeV2_1Data>> {
    try {
      const _srcToken = this.dexHelper.config.wrapETH(from);
      const _destToken = this.dexHelper.config.wrapETH(to);

      const [_srcAddress, _destAddress] = this._getLoweredAddresses(
        _srcToken,
        _destToken,
      );

      if (_srcAddress === _destAddress) return null;

      let selectedPools: TraderJoeV2_1EventPool[] = [];
    } catch (error) {
      this.logger.error(
        `Error_getPricesVolume ${from.symbol || from.address}, ${
          to.symbol || to.address
        }, ${side}:`,
        error,
      );
      return null;
    }

    return null;
  }

  getPoolIdentifier(
    srcAddress: Address,
    destAddress: Address,
    binStep: bigint,
  ): string {
    const tokenAddresses = this._sortTokens(srcAddress, destAddress).join('_');
    return `${this.dexKey}_${tokenAddresses}_${binStep}`;
  }

  private getPool(
    srcAddress: Address,
    destAddress: Address,
    binStep: bigint,
    blockNumber: number,
  ) {
    let pool =
      this.eventPools[this.getPoolIdentifier(srcAddress, destAddress, binStep)];

    // if (pool === null) return null;
    return pool;

    // TODO: Try to init pool
  }

  private _sortTokens(srcAddress: Address, destAddress: Address) {
    return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
  }

  private _getLoweredAddresses(srcToken: Token, destToken: Token) {
    return [srcToken.address.toLowerCase(), destToken.address.toLowerCase()];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<TraderJoeV2_1Data>,
  ): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> path header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> deadline
      CALLDATA_GAS_COST.TIMESTAMP +
      // ParentStruct -> path (20+3+20 = 43 = 32+11 bytes)
      CALLDATA_GAS_COST.LENGTH_SMALL +
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.wordNonZeroBytes(11)
    );
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: TraderJoeV2_1Data,
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

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: TraderJoeV2_1Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? TraderJoeV2RouterFunctions.swapExactTokensForTokens
        : TraderJoeV2RouterFunctions.swapTokensForExactTokens;

    const swapFunctionParams: TraderJoeV2RouterParam =
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
