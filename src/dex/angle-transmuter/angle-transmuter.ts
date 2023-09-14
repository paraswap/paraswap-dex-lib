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
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AngleTransmuterData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AngleTransmuterConfig, Adapters } from './config';
import { AngleTransmuterEventPool } from './angle-transmuter-pool';
import { Interface, formatUnits, parseUnits } from 'ethers/lib/utils';
import { TransmuterSubscriber } from './transmuter';
import ERC20ABI from '../../abi/erc20.json';
import _ from 'lodash';

const TransmuterGasCost = 0;

export class AngleTransmuter
  extends SimpleExchange
  implements IDex<AngleTransmuterData>
{
  protected eventPools: AngleTransmuterEventPool | null = null;
  protected supportedTokensMap: { [address: string]: boolean } = {};
  // supportedTokens is only used by the pooltracker
  protected supportedTokens: Token[] = [];
  transmuterUSDLiquidity: number = 0;

  public static erc20Interface = new Interface(ERC20ABI);

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AngleTransmuterConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected params: DexParams = AngleTransmuterConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.supportedTokensMap[params.agEUR.address.toLowerCase()] = true;
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    const config = await AngleTransmuterEventPool.getConfig(
      this.params,
      blockNumber,
      this.dexHelper.multiContract,
    );
    config.collaterals.forEach(
      (token: Address) => (this.supportedTokensMap[token.toLowerCase()] = true),
    );
    this.eventPools = new AngleTransmuterEventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
      config,
    );
    await this.eventPools.initialize(blockNumber);
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
    if (this._knownAddress(srcToken, destToken))
      return [`${this.dexKey}_${this.params.agEUR.address.toLowerCase()}`];
    else return [];
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
  ): Promise<null | ExchangePrices<AngleTransmuterData>> {
    const uniquePool = `${
      this.dexKey
    }_${this.params.agEUR.address.toLowerCase()}`;
    if (
      !this._knownAddress(srcToken, destToken) ||
      (limitPools && limitPools.length > 0 && !limitPools.includes(uniquePool))
    )
      return null;

    const preProcessDecimals =
      side == SwapSide.SELL ? srcToken.decimals : destToken.decimals;
    const postProcessDecimals =
      side == SwapSide.SELL ? destToken.decimals : srcToken.decimals;
    const unitVolume = 1;
    const amountsFloat = amounts.map(amount =>
      parseFloat(formatUnits(amount.toString(), preProcessDecimals)),
    );

    const prices = await this.eventPools!.getAmountOut(
      srcToken.address,
      destToken.address,
      side,
      [unitVolume, ...amountsFloat],
      blockNumber,
    );

    if (!prices) return null;

    const pricesBigInt = prices.map(price =>
      BigInt(
        parseUnits(
          price.toFixed(postProcessDecimals).toString(),
          postProcessDecimals,
        ).toString(),
      ),
    );

    return [
      {
        prices: pricesBigInt.slice(1),
        unit: pricesBigInt[0],
        gasCost: TransmuterGasCost,
        exchange: this.dexKey,
        data: { exchange: this.params.transmuter },
        poolAddresses: [this.params.transmuter],
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<AngleTransmuterData>,
  ): number | number[] {
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
    data: AngleTransmuterData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
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
    data: AngleTransmuterData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { exchange } = data;

    // Encode here the transaction arguments
    const swapData = TransmuterSubscriber.interface.encodeFunctionData(
      side == SwapSide.SELL ? 'swapExactInput' : 'swapExactOutput',
      [
        side == SwapSide.SELL ? srcAmount : destAmount,
        side == SwapSide.SELL ? destAmount : srcAmount,
        srcToken,
        destToken,
        this.augustusAddress,
        0, // TODO no deadline?
      ],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    if (!this.supportedTokens.length) {
      let tokenAddresses = await AngleTransmuterEventPool.getCollateralsList(
        this.params.transmuter,
        'latest',
        this.dexHelper.multiContract,
      );
      tokenAddresses = tokenAddresses.concat([this.params.agEUR.address]);

      const decimalsCallData =
        AngleTransmuter.erc20Interface.encodeFunctionData('decimals');
      const tokenBalanceMultiCall = tokenAddresses.map(t => ({
        target: t,
        callData: decimalsCallData,
      }));
      const res = (
        await this.dexHelper.multiContract.methods
          .aggregate(tokenBalanceMultiCall)
          .call()
      ).returnData;

      const tokenDecimals = res.map((r: any) =>
        parseInt(
          AngleTransmuter.erc20Interface
            .decodeFunctionResult('decimals', r)[0]
            .toString(),
        ),
      );

      this.supportedTokens = tokenAddresses.map((t, i) => ({
        address: t,
        decimals: tokenDecimals[i],
      }));
    }

    // Only work if there are no managers
    const erc20BalanceCalldata =
      AngleTransmuter.erc20Interface.encodeFunctionData('balanceOf', [
        this.params.transmuter,
      ]);
    const tokenBalanceMultiCall = this.supportedTokens.map(t => ({
      target: t.address,
      callData: erc20BalanceCalldata,
    }));
    const res = (
      await this.dexHelper.multiContract.methods
        .aggregate(tokenBalanceMultiCall)
        .call()
    ).returnData;
    const tokenBalances = res.map((r: any) =>
      BigInt(
        AngleTransmuter.erc20Interface
          .decodeFunctionResult('balanceOf', r)[0]
          .toString(),
      ),
    );

    // TODO bC3M price not detected
    const tokenBalancesUSD = await Promise.all(
      this.supportedTokens.map((t, i) =>
        this.dexHelper.getTokenUSDPrice(t, tokenBalances[i]),
      ),
    );
    this.transmuterUSDLiquidity = tokenBalancesUSD.reduce(
      (sum: number, curr: number) => sum + curr,
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.supportedTokens.some(t => t.address === tokenAddress)) return [];

    const connectorTokens =
      tokenAddress === this.params.agEUR.address
        ? this.supportedTokens.filter(
            token => token.address !== this.params.agEUR.address,
          )
        : [this.params.agEUR];
    return [
      {
        exchange: this.dexKey,
        address: this.params.transmuter,
        connectorTokens: connectorTokens.slice(0, limit),
        // liquidity is potentially infinite if swapping for agXXX, otherwise at most reserves value
        liquidityUSD:
          tokenAddress == this.params.agEUR.address
            ? this.transmuterUSDLiquidity
            : 1e9,
      },
    ];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}

  _knownAddress(srcToken: Token, destToken: Token): boolean {
    const srcAddress = this.dexHelper.config
      .wrapETH(srcToken)
      .address.toLowerCase();
    const destAddress = this.dexHelper.config
      .wrapETH(destToken)
      .address.toLowerCase();
    if (
      srcAddress !== destAddress &&
      this.supportedTokensMap[srcAddress] &&
      this.supportedTokensMap[destAddress] &&
      // check that at least one of the tokens is agEUR
      (srcAddress == this.params.agEUR.address.toLowerCase() ||
        destAddress == this.params.agEUR.address.toLowerCase())
    ) {
      return true;
    }
    return false;
  }
}
