import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network, ProviderURL } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { IbAmmData, IbAmmFunctions, IbAmmParams, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { IbAmmConfig, Adapters } from './config';
import IBAmmRouterABI from '../../abi/ib-amm/ib-amm.json';
import { toLC } from './utils';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';

export class IbAmm extends SimpleExchange implements IDex<IbAmmData> {
  readonly hasConstantPriceLargeAmounts = false;

  static dexKeys = ['ibamm'];
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(IbAmmConfig);

  logger: Logger;
  exchangeRouterInterface: Interface;
  poolIdentifier: string;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected config = IbAmmConfig[dexKey][network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.exchangeRouterInterface = new Interface(IBAmmRouterABI);
    this.poolIdentifier = `${this.dexKey}_${this.config.IBAMM_ADDRESS}`;
  }

  private poolExists(from: Token, to: Token): boolean {
    const isBuy = toLC(from.address) === toLC(this.config.DAI);

    if (toLC(from.address) === toLC(to.address)) return false;

    if (isBuy) {
      if (this.config.IB_TOKENS.every(a => toLC(a) !== toLC(to.address)))
        return false;
    } else {
      if (toLC(to.address) !== toLC(this.config.MIM)) return false;

      if (this.config.IB_TOKENS.every(a => toLC(a) !== toLC(from.address)))
        return false;
    }

    return true;
  }

  private getQuote(isBuy: boolean) {
    const provider = new JsonRpcProvider(ProviderURL[Network.MAINNET]);

    const ibammContract = new Contract(
      this.config.IBAMM_ADDRESS,
      IBAmmRouterABI,
      provider,
    );

    return isBuy ? ibammContract.buy_quote : ibammContract.sell_quote;
  }

  async initializePricing(blockNumber: number) {}

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  /**
   * Ib-amm doesn't have pools, instead it's just a single contract with two functions, buy and sell.
   *
   * - When buy is called, the caller transfers DAI to the contract and the contract borrows the caller's desired ibToken to give to the caller.
   *
   * - When sell is called, the caller transfers an ibToken to the contract and the contract mints MIM to the caller.
   * Therefore, the "pool" in this case will always be the ib-amm's contract address
   */
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!this.poolExists(srcToken, destToken)) [];

    return [this.poolIdentifier];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<IbAmmData>> {
    if (limitPools && limitPools.every(p => p !== this.poolIdentifier))
      return null;

    if (!this.poolExists(srcToken, destToken)) null;

    const isBuy = toLC(srcToken.address) === toLC(this.config.DAI);

    const token = isBuy ? destToken : srcToken;

    const unitAmount = BigInt(10 ** token.decimals);

    const quote = this.getQuote(isBuy);

    const [unit, ...prices] = (await Promise.all(
      [unitAmount, ...amounts].map(async amount =>
        BigInt(await quote(token.address, amount)),
      ),
    )) as bigint[];

    return [
      {
        data: {},
        exchange: this.dexKey,
        gasCost: 200_000,
        prices,
        unit,
        poolAddresses: [this.poolIdentifier],
      },
    ] as ExchangePrices<IbAmmData>;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: IbAmmData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: this.config.IBAMM_ADDRESS,
      payload: '0x0',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcTokenAddress: string,
    destTokenAddress: string,
    srcAmount: string,
    destAmount: string,
    data: IbAmmData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    /**
     * # swapFunctionParams
     *
     * There are two cases: buy and sell.
     *
     * - When the function is a buy, the operation goes from DAI --> any ibToken.
     * In ib-amm, the function buy takes in (ibTokenAddress, amountOfDAIToSwap, minAmountOut).
     * The minAmountOut is calculated calling buy_quote with ibTokenAddress and amountOFDAIToSwap,
     * and multiplying the result by 0.97.
     *
     * - When the function is sell, the operation goes from ibToken --> MIM.
     * In ib-amm, the function sell takes in (ibTokenAddress, amountOfIbTokenToSwap, minAmountOut).
     * The minAmountOut is calculated by calling sell_quoute with ibTokenAddress and amountOfIbTokenToSwap,
     * and  multiplying the result by 0.97.
     */

    const isBuy = toLC(srcTokenAddress) === toLC(this.config.DAI);
    const tokenAddress = isBuy ? destTokenAddress : srcTokenAddress;
    const quote = this.getQuote(isBuy);
    const quotedAmount = (await quote(tokenAddress, srcAmount)) as string;
    const minOut = (BigInt(quotedAmount) * BigInt(97)) / BigInt(100);

    const swapFunctionParams: IbAmmParams = [
      isBuy ? destTokenAddress : srcTokenAddress,
      srcAmount,
      minOut.toString(),
    ];

    const swapFunction = isBuy ? IbAmmFunctions.buy : IbAmmFunctions.sell;

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcTokenAddress,
      srcAmount,
      destTokenAddress,
      destAmount,
      swapData,
      this.config.IBAMM_ADDRESS,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }
}
