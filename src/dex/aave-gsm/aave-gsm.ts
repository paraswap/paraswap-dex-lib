import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  PoolLiquidity,
  Logger,
  NumberAsString,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AaveGsmData, DexParams, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AaveGsmConfig, Adapters } from './config';

import GSM_ABI from '../../abi/aave-gsm/Aave_GSM.json';
import { Interface } from '@ethersproject/abi';
import { MultiResult } from '../../lib/multi-wrapper';
import { BytesLike } from 'ethers';
import { generalDecoder, uint256ToBigInt } from '../../lib/decoders';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { erc20Iface } from '../../lib/tokens/utils';
import { AaveGsmEventPool } from './aave-gsm-pool';
import { MMath } from '../maverick-v1/maverick-math/maverick-basic-math';

export class AaveGsm extends SimpleExchange implements IDex<AaveGsmData> {
  static readonly gsmInterface = new Interface(GSM_ABI);
  protected eventPools: Record<string, AaveGsmEventPool>;

  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AaveGsmConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    const config = AaveGsmConfig[dexKey][network];
    this.config = {
      GSM_USDT: config.GSM_USDT.toLowerCase(),
      GSM_USDC: config.GSM_USDC.toLowerCase(),
      USDT: config.USDT.toLowerCase(),
      USDC: config.USDC.toLowerCase(),
      GHO: config.GHO.toLowerCase(),
    };

    this.logger = dexHelper.getLogger(dexKey);

    this.eventPools = {
      [this.config.GSM_USDT]: new AaveGsmEventPool(
        this.config.GSM_USDT,
        this.dexKey,
        this.network,
        this.dexHelper,
        this.logger,
      ),
      [this.config.GSM_USDC]: new AaveGsmEventPool(
        this.config.GSM_USDC,
        this.dexKey,
        this.network,
        this.dexHelper,
        this.logger,
      ),
    };
  }

  async initializePoolPricing(pool: AaveGsmEventPool, blockNumber: number) {
    const state = await pool.generateState(blockNumber);

    pool.initialize(blockNumber, {
      state,
    });
  }

  async initializePricing(blockNumber: number) {
    await this.initializePoolPricing(
      this.eventPools[this.config.GSM_USDT],
      blockNumber,
    );
    await this.initializePoolPricing(
      this.eventPools[this.config.GSM_USDC],
      blockNumber,
    );
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();

    if (
      (srcTokenAddress === this.config.GHO &&
        destTokenAddress === this.config.USDT) ||
      (srcTokenAddress === this.config.USDT &&
        destTokenAddress === this.config.GHO)
    ) {
      return [`${this.dexKey}_${this.config.GSM_USDT}`];
    } else if (
      (srcTokenAddress === this.config.GHO &&
        destTokenAddress === this.config.USDC) ||
      (srcTokenAddress === this.config.USDC &&
        destTokenAddress === this.config.GHO)
    ) {
      return [`${this.dexKey}_${this.config.GSM_USDC}`];
    } else {
      return [];
    }
  }

  async updatePoolState(): Promise<void> {
    const blockNumber = await this.dexHelper.web3Provider.eth.getBlockNumber();
    await this.initializePricing(blockNumber);
  }

  async getPoolState(gsm: string, blockNumber?: number): Promise<PoolState> {
    if (!blockNumber) {
      return this.eventPools[gsm].getStaleState()!;
    }
    const eventState = this.eventPools[gsm].getState(blockNumber);
    if (eventState) return eventState;
    const onChainState = await this.eventPools[gsm].generateState(blockNumber);
    this.eventPools[gsm].setState(onChainState, blockNumber);
    return onChainState;
  }

  getGhoAmountForBuyAsset(assetAmount: bigint, state: PoolState) {
    if (assetAmount == 0n) {
      return 0n;
    }

    const grossAmount = assetAmount * 1_000_000_000_000n; // 18 - 6 = 12 (decimals)
    const fee = MMath.mulDiv(grossAmount, state.buyFee, 10_000n, true);

    return grossAmount + fee;
  }

  getAssetAmountForBuyAsset(ghoAmount: bigint, state: PoolState) {
    const grossAmount = (ghoAmount * 10_000n) / (10_000n + state.buyFee);

    return grossAmount / 1_000_000_000_000n; // 18 - 6 = 12 (decimals)
  }

  getGhoAmountForSellAsset(assetAmount: bigint, state: PoolState) {
    if (assetAmount == 0n) {
      return 0n;
    }

    const grossAmount = assetAmount * 1_000_000_000_000n; // 18 - 6 = 12 (decimals)
    const fee = MMath.mulDiv(grossAmount, state.sellFee, 10_000n, true);

    return grossAmount - fee;
  }

  getAssetAmountForSellAsset(ghoAmount: bigint, state: PoolState) {
    const grossAmount = MMath.mulDiv(
      ghoAmount,
      10_000n,
      10_000n - state.sellFee,
      true,
    );

    return MMath.mulDiv(grossAmount, 1n, 1_000_000_000_000n, true); // 18 - 6 = 12 (decimals)
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<AaveGsmData>> {
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();

    if (
      !(
        (srcTokenAddress == this.config.GHO &&
          (destTokenAddress == this.config.USDC ||
            destTokenAddress == this.config.USDT)) ||
        (destTokenAddress == this.config.GHO &&
          (srcTokenAddress == this.config.USDC ||
            srcTokenAddress == this.config.USDT))
      )
    ) {
      return null;
    }

    let endpoint: Function;
    let target: string;
    let gas: number;

    if (
      srcTokenAddress == this.config.USDT ||
      destTokenAddress == this.config.USDT
    ) {
      target = this.config.GSM_USDT;
    } else {
      target = this.config.GSM_USDC;
    }

    if (srcTokenAddress == this.config.GHO && side == SwapSide.BUY) {
      endpoint = this.getGhoAmountForBuyAsset;
      gas = 80_000;
    } else if (srcTokenAddress == this.config.GHO && side == SwapSide.SELL) {
      endpoint = this.getAssetAmountForBuyAsset;
      gas = 80_000;
    } else if (destTokenAddress == this.config.GHO && side == SwapSide.SELL) {
      endpoint = this.getGhoAmountForSellAsset;
      gas = 70_000;
    } else {
      endpoint = this.getAssetAmountForSellAsset;
      gas = 70_000;
    }

    const unit = parseUnits(
      '1',
      side == SwapSide.SELL ? srcToken.decimals : destToken.decimals,
    ).toBigInt();

    const poolState = await this.getPoolState(target, blockNumber);

    return [
      {
        unit: endpoint(unit, poolState),
        prices: amounts.map(amount => endpoint(amount, poolState)),
        data: {
          exchange: this.dexKey,
        },
        poolAddresses: [target],
        exchange: this.dexKey,
        gasCost: gas,
        poolIdentifier: `${this.dexKey}_${target}`,
      },
    ];
  }

  getCalldataGasCost(poolPrices: PoolPrices<AaveGsmData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AaveGsmData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

  async getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: AaveGsmData,
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    const isSrcGho = srcToken.toLowerCase() === this.config.GHO;
    const swapFunction = isSrcGho ? 'buyAsset' : 'sellAsset';
    const ghoAmount = isSrcGho ? srcAmount : destAmount;
    let assetAmount = isSrcGho ? destAmount : srcAmount;
    const targetExchange =
      srcToken.toLowerCase() === this.config.USDT ||
      destToken.toLowerCase() === this.config.USDT
        ? this.config.GSM_USDT
        : this.config.GSM_USDC;

    if (BigInt(assetAmount) == 1n) {
      const poolState = await this.getPoolState(targetExchange);
      assetAmount = isSrcGho
        ? this.getAssetAmountForBuyAsset(
            BigInt(ghoAmount),
            poolState,
          ).toString()
        : this.getAssetAmountForSellAsset(
            BigInt(ghoAmount),
            poolState,
          ).toString();
    }

    const exchangeData = AaveGsm.gsmInterface.encodeFunctionData(swapFunction, [
      assetAmount,
      recipient,
    ]);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange,
      returnAmountPos: isSrcGho ? 1 : 0,
    };
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    tokenAddress = tokenAddress.toLowerCase();

    if (tokenAddress == this.config.GHO) {
      const usdtState = this.eventPools[this.config.GSM_USDT].getStaleState()!;
      const usdcState = this.eventPools[this.config.GSM_USDC].getStaleState()!;

      return [
        {
          exchange: this.dexKey,
          address: this.config.GSM_USDT,
          connectorTokens: [
            {
              decimals: 6,
              address: this.config.USDT,
            },
          ],
          liquidityUSD: +formatUnits(usdtState.underlyingLiquidity, 6),
        },
        {
          exchange: this.dexKey,
          address: this.config.GSM_USDC,
          connectorTokens: [
            {
              decimals: 6,
              address: this.config.USDC,
            },
          ],
          liquidityUSD: +formatUnits(usdcState.underlyingLiquidity, 6),
        },
      ];
    } else if (tokenAddress == this.config.USDC) {
      return [
        {
          exchange: this.dexKey,
          address: this.config.GSM_USDC,
          connectorTokens: [
            {
              decimals: 18,
              address: this.config.GHO,
            },
          ],
          liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
        },
      ];
    } else if (tokenAddress == this.config.USDT) {
      return [
        {
          exchange: this.dexKey,
          address: this.config.GSM_USDT,
          connectorTokens: [
            {
              decimals: 18,
              address: this.config.GHO,
            },
          ],
          liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
        },
      ];
    } else {
      return [];
    }
  }
}
