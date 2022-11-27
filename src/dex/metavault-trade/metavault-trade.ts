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
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MetavaultTradeData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { MetavaultTradeConfig, Adapters } from './config';
import { MetavaultTradeEventPool } from './metavault-trade-pool';
import { Vault } from './vault';
import ERC20ABI from '../../abi/erc20.json';

const MetavaultTradeGasCost = 300 * 1000;

export class MetavaultTrade
  extends SimpleExchange
  implements IDex<MetavaultTradeData>
{
  protected pool: MetavaultTradeEventPool | null = null;
  protected supportedTokensMap: { [address: string]: boolean } = {};
  // supportedTokens is only used by the pooltracker
  protected supportedTokens: Token[] = [];

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(MetavaultTradeConfig);

  public static erc20Interface = new Interface(ERC20ABI);

  vaultUSDBalance: number = 0;

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected params: DexParams = MetavaultTradeConfig[dexKey][network],
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    const config = await MetavaultTradeEventPool.getConfig(
      this.params,
      blockNumber,
      this.dexHelper.multiContract,
    );

    config.tokenAddresses.forEach(
      (token: Address) => (this.supportedTokensMap[token] = true),
    );
    this.pool = new MetavaultTradeEventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
      config,
    );

    this.dexHelper.blockManager.subscribeToLogs(
      this.pool,
      this.pool.addressesSubscribed,
      blockNumber,
    );

    // await this.pool.initialize(blockNumber);
  }

  async getEventPoolForBlock(blockNumber: number) {
    const config = await MetavaultTradeEventPool.getConfig(
      this.params,
      blockNumber,
      this.dexHelper.multiContract,
    );

    const pool = new MetavaultTradeEventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
      config,
    );

    return pool;
  }

  async getConfig(blockNumber: number) {
    const config = await MetavaultTradeEventPool.getConfig(
      this.params,
      blockNumber,
      this.dexHelper.multiContract,
    );
    return config;
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
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
    if (side === SwapSide.BUY || !this.pool) return [];
    const srcAddress = this.dexHelper.config
      .wrapETH(srcToken)
      .address.toLowerCase();
    const destAddress = this.dexHelper.config
      .wrapETH(destToken)
      .address.toLowerCase();

    if (
      srcAddress !== destAddress &&
      this.supportedTokensMap[srcAddress] &&
      this.supportedTokensMap[destAddress]
    ) {
      return [`${this.dexKey}_${srcAddress}`, `${this.dexKey}_${destAddress}`];
    }
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
  ): Promise<null | ExchangePrices<MetavaultTradeData>> {
    if (side === SwapSide.BUY || !this.pool) return null;
    const srcAddress = this.dexHelper.config
      .wrapETH(srcToken)
      .address.toLowerCase();
    const destAddress = this.dexHelper.config
      .wrapETH(destToken)
      .address.toLowerCase();
    if (
      srcAddress === destAddress ||
      !(
        this.supportedTokensMap[srcAddress] &&
        this.supportedTokensMap[destAddress]
      )
    )
      return null;
    const srcPoolIdentifier = `${this.dexKey}_${srcAddress}`;
    const destPoolIdentifier = `${this.dexKey}_${destAddress}`;

    const pools = [srcPoolIdentifier, destPoolIdentifier];
    if (limitPools && pools.some(p => !limitPools.includes(p))) return null;

    const unitVolume = getBigIntPow(srcToken.decimals);

    const prices = await this.pool.getAmountOut(
      srcAddress,
      destAddress,
      [unitVolume, ...amounts],
      blockNumber,
    );

    if (!prices) return null;

    return [
      {
        prices: prices.slice(1),
        unit: prices[0],
        gasCost: MetavaultTradeGasCost,
        exchange: this.dexKey,
        data: {},
        poolAddresses: [this.params.vault],
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<MetavaultTradeData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: MetavaultTradeData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: this.params.vault,
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: MetavaultTradeData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    return {
      callees: [srcToken, this.params.vault],
      calldata: [
        MetavaultTrade.erc20Interface.encodeFunctionData('transfer', [
          this.params.vault,
          srcAmount,
        ]),
        Vault.interface.encodeFunctionData('swap', [
          srcToken,
          destToken,
          this.augustusAddress,
        ]),
      ],
      values: ['0', '0'],
      networkFee: '0',
    };
  }

  async updatePoolState(): Promise<void> {
    if (!this.supportedTokens.length) {
      const tokenAddresses = await MetavaultTradeEventPool.getWhitelistedTokens(
        this.params.vault,
        'latest',
        this.dexHelper.multiContract,
      );

      const decimalsCallData =
        MetavaultTrade.erc20Interface.encodeFunctionData('decimals');
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
          MetavaultTrade.erc20Interface
            .decodeFunctionResult('decimals', r)[0]
            .toString(),
        ),
      );

      this.supportedTokens = tokenAddresses.map((t, i) => ({
        address: t,
        decimals: tokenDecimals[i],
      }));
    }

    const erc20BalanceCalldata =
      MetavaultTrade.erc20Interface.encodeFunctionData('balanceOf', [
        this.params.vault,
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
        MetavaultTrade.erc20Interface
          .decodeFunctionResult('balanceOf', r)[0]
          .toString(),
      ),
    );
    const tokenBalancesUSD = await Promise.all(
      this.supportedTokens.map((t, i) =>
        this.dexHelper.getTokenUSDPrice(t, tokenBalances[i]),
      ),
    );

    this.vaultUSDBalance = tokenBalancesUSD.reduce(
      (sum: number, curr: number) => sum + curr,
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    _tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const tokenAddress = _tokenAddress.toLowerCase();
    if (!this.supportedTokens.some(t => t.address === tokenAddress)) return [];
    return [
      {
        exchange: this.dexKey,
        address: this.params.vault,
        connectorTokens: this.supportedTokens.filter(
          t => t.address !== tokenAddress,
        ),
        liquidityUSD: this.vaultUSDBalance,
      },
    ];
  }
}
