import { Network, SwapSide } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Adapters, BMXConfig } from './config';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  Logger,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { Interface } from '@ethersproject/abi';
import RewardRouterABI from '../../abi/bmx/reward-router-v3.json';
import YearnTokenVaultABI from '../../abi/bmx/yearn-token-vault.json';
import ERC20ABI from '../../abi/erc20.json';
import { BigNumber } from 'ethers';
import { SimpleExchange } from '../simple-exchange';
import { IDex } from '../idex';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { DexParams, GMXData } from './types';
import { Vault } from './vault';
import { GMXEventPool } from './pool';

/**
 * BMX model is GMX fork with added path for swapping in/out WBLT.
 * WBLT stands for Wrapped BMX Liqduiity Token (autocompunded GLP).
 *
 * @dev BMX cannot extend GMX classes as changes to logic are somewhat complex.
 */
export class BMX extends SimpleExchange implements IDex<GMXData> {
  /*** WBLT members ***/
  protected bmxGasCost = 300 * 1000; // TODO: check
  public static rewardRouterInterface = new Interface(RewardRouterABI);
  public static wbltInterface = new Interface(YearnTokenVaultABI);

  /*** GMX members ***/
  protected pool: GMXEventPool | null = null;
  protected supportedTokensMap: { [address: string]: boolean } = {};
  // supportedTokens is only used by the pooltracker
  protected supportedTokens: Token[] = [];

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;

  public static erc20Interface = new Interface(ERC20ABI);
  vaultUSDBalance: number = 0;
  logger: Logger;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BMXConfig);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected params: DexParams = BMXConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests.
  async initializePricing(blockNumber: number) {
    const config = await GMXEventPool.getConfig(
      this.params,
      blockNumber,
      this.dexHelper.multiContract,
    );
    config.tokenAddresses.forEach(
      (token: Address) => (this.supportedTokensMap[token] = true),
    );
    // Add wBLT to supported tokens
    this.supportedTokensMap[this.params.wblt.toLowerCase()] = true;
    this.pool = new GMXEventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
      config,
    );
    await this.pool.initialize(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes.
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
  ): Promise<null | ExchangePrices<GMXData>> {
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

    if (
      srcAddress.toLowerCase() === this.params.wblt.toLowerCase() ||
      destAddress.toLowerCase() === this.params.wblt.toLowerCase()
    ) {
      // handle WBLT deposit/withdrawal estimations
      if (srcAddress.toLowerCase() === this.params.wblt.toLowerCase()) {
        // TODO: Simulate withdrawing
        return [
          {
            prices: amounts,
            unit: BigInt(1e18),
            gasCost: this.bmxGasCost,
            exchange: this.dexKey,
            data: {},
            poolAddresses: [this.params.vault],
          },
        ];
      } else {
        const unitVolume = getBigIntPow(srcToken.decimals);
        const prices = await this.pool.buyWBLTAmountsOut(
          srcAddress,
          this.params.wblt.toLowerCase(),
          [unitVolume, ...amounts],
          blockNumber,
        );

        if (!prices) return null;

        return [
          {
            prices: prices.slice(1),
            unit: prices[0],
            gasCost: this.bmxGasCost,
            exchange: this.dexKey,
            data: {},
            poolAddresses: [this.params.vault],
          },
        ];
      }
    } else {
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
          gasCost: this.bmxGasCost,
          exchange: this.dexKey,
          data: {},
          poolAddresses: [this.params.vault],
        },
      ];
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<GMXData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD; // TODO
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: GMXData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: this.params.vault, // TODO
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: GMXData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (srcToken.toLowerCase() === this.params.wblt.toLowerCase()) {
      // TODO Withdraw WBLT
      const withdrawCalldata = BMX.wbltInterface.encodeFunctionData(
        'withdraw()',
        [],
      );

      const approveBLTParam = await this.getApproveSimpleParam(
        this.params.stakedGLP,
        this.params.glpManager,
        destAmount,
      );

      const unstakeAndRedeemGlpCalldata =
        BMX.rewardRouterInterface.encodeFunctionData('unstakeAndRedeemGlp', [
          destToken,
          destAmount,
          BigNumber.from('0'),
          BigNumber.from('0'), //TODO: GLP threshold in DEXParams
        ]);

      const valuesToSend = ['0', ...approveBLTParam.values, '0'];

      return {
        callees: [
          this.params.wblt,
          ...approveBLTParam.callees,
          this.params.rewardRouter,
        ],
        calldata: [
          withdrawCalldata,
          ...approveBLTParam.calldata,
          unstakeAndRedeemGlpCalldata,
        ],
        values: valuesToSend,
        networkFee: '0',
      };
    }
    if (destToken.toLowerCase() === this.params.wblt.toLowerCase()) {
      // Deposit WBLT
      const approveSrcTokenParam = await this.getApproveSimpleParam(
        srcToken,
        this.params.glpManager,
        srcAmount,
      );

      const mintAndStakeGlpCalldata =
        BMX.rewardRouterInterface.encodeFunctionData('mintAndStakeGlp', [
          srcToken,
          srcAmount,
          BigNumber.from('0'),
          BigNumber.from('0'), //TODO: GLP threshold in DEXParams
        ]);

      const approveBLTParam = await this.getApproveSimpleParam(
        this.params.stakedGLP,
        this.params.wblt,
        destAmount,
      );

      const depositCalldata = BMX.wbltInterface.encodeFunctionData(
        'deposit()',
        [],
      );
      const valuesToSend = [
        ...approveSrcTokenParam.values,
        '0',
        ...approveBLTParam.values,
        '0',
      ];

      return {
        callees: [
          ...approveSrcTokenParam.callees,
          this.params.rewardRouter,
          ...approveBLTParam.callees,
          this.params.wblt,
        ],
        calldata: [
          ...approveSrcTokenParam.calldata,
          mintAndStakeGlpCalldata,
          ...approveBLTParam.calldata,
          depositCalldata,
        ],
        values: valuesToSend,
        networkFee: '0',
      };
    }
    // Normal Vault Swap
    return {
      callees: [srcToken, this.params.vault],
      calldata: [
        BMX.erc20Interface.encodeFunctionData('transfer', [
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
      const tokenAddresses = await GMXEventPool.getWhitelistedTokens(
        this.params.vault,
        'latest',
        this.dexHelper.multiContract,
      );

      const decimalsCallData =
        BMX.erc20Interface.encodeFunctionData('decimals');
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
          BMX.erc20Interface.decodeFunctionResult('decimals', r)[0].toString(),
        ),
      );

      this.supportedTokens = tokenAddresses.map((t, i) => ({
        address: t,
        decimals: tokenDecimals[i],
      }));
    }

    const erc20BalanceCalldata = BMX.erc20Interface.encodeFunctionData(
      'balanceOf',
      [this.params.vault],
    );
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
        BMX.erc20Interface.decodeFunctionResult('balanceOf', r)[0].toString(),
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
      // TODO: add WBLT case
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
