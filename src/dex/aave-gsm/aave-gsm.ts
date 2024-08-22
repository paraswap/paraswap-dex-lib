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
import { AaveGsmData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AaveGsmConfig, Adapters } from './config';

import GSM_ABI from '../../abi/Aave_GSM.json';
import { Interface } from '@ethersproject/abi';
import { MultiResult } from '../../lib/multi-wrapper';
import { BytesLike } from 'ethers';
import { generalDecoder } from '../../lib/decoders';
import { parseUnits } from 'ethers/lib/utils';

export class AaveGsm extends SimpleExchange implements IDex<AaveGsmData> {
  // protected eventPools: AaveGsmEventPool;
  static readonly gsmInterface = new Interface(GSM_ABI);

  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AaveGsmConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
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
    // this.eventPools = new AaveGsmEventPool(
    //   dexKey,
    //   network,
    //   dexHelper,
    //   this.logger,
    // );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
    // const poolState = await getOnChainState(
    //   this.dexHelper.multiContract,
    //   this.swETHAddress,
    //   this.swETHInterface,
    //   blockNumber,
    // );
    // await this.eventPools.initialize(blockNumber, {
    //   state: poolState,
    // });
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
  ): Promise<null | ExchangePrices<AaveGsmData>> {
    // TODO: complete me!
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

    let endpoint: string;
    let target: string;
    let resultIsGho: boolean;
    if (srcTokenAddress == this.config.GHO && side == SwapSide.BUY) {
      endpoint = 'getGhoAmountForBuyAsset';
      resultIsGho = true;
    } else if (srcTokenAddress == this.config.GHO && side == SwapSide.SELL) {
      endpoint = 'getAssetAmountForBuyAsset';
      resultIsGho = false;
    } else if (destTokenAddress == this.config.GHO && side == SwapSide.SELL) {
      endpoint = 'getGhoAmountForSellAsset';
      resultIsGho = true;
    } else {
      endpoint = 'getAssetAmountForSellAsset';
      resultIsGho = false;
    }

    if (
      srcTokenAddress == this.config.USDT ||
      destTokenAddress == this.config.USDT
    ) {
      target = this.config.GSM_USDT;
    } else {
      target = this.config.GSM_USDC;
    }

    const unit = parseUnits(
      '1',
      side == SwapSide.SELL ? srcToken.decimals : destToken.decimals,
    ).toBigInt();

    const amountsWithUnit = [...amounts, unit];

    const calls = amountsWithUnit.map(amount => ({
      target,
      callData: AaveGsm.gsmInterface.encodeFunctionData(endpoint, [amount]),
      decodeFunction: (
        result: MultiResult<BytesLike> | BytesLike,
      ): { underlying: bigint; gho: bigint } => {
        return generalDecoder(
          result,
          ['uint256', 'uint256', 'uint256', 'uint256'],
          {
            underlying: 0n,
            gho: 0n,
          },
          value => ({
            underlying: value[0].toBigInt(),
            gho: value[1].toBigInt(),
          }),
        );
      },
    }));

    let results = await this.dexHelper.multiWrapper.tryAggregate<{
      underlying: bigint;
      gho: bigint;
    }>(true, calls, blockNumber);

    const unitPriceResult = results.pop()!;

    return [
      {
        unit: resultIsGho
          ? unitPriceResult.returnData.gho
          : unitPriceResult.returnData.underlying,
        prices: results.map(result =>
          resultIsGho ? result.returnData.gho : result.returnData.underlying,
        ),
        data: {
          exchange: this.dexKey,
        },
        poolAddresses: [target],
        exchange: this.dexKey,
        gasCost: 130000,
        poolIdentifier: `${this.dexKey}_${target}`,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<AaveGsmData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
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
    const swapFunction =
      srcToken.toLowerCase() === this.config.GHO ? 'buyAsset' : 'sellAsset';
    const assetAmount =
      srcToken.toLowerCase() === this.config.GHO ? destAmount : srcAmount;
    const exchangeData = AaveGsm.gsmInterface.encodeFunctionData(swapFunction, [
      assetAmount,
      recipient,
    ]);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange:
        srcToken.toLowerCase() === this.config.USDT ||
        destToken.toLowerCase() === this.config.USDT
          ? this.config.GSM_USDT
          : this.config.GSM_USDC,
      returnAmountPos: srcToken.toLowerCase() === this.config.GHO ? 1 : 0,
    };
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
    tokenAddress = tokenAddress.toLowerCase();

    if (tokenAddress == this.config.GHO) {
      return [
        {
          exchange: this.dexKey,
          address: this.config.GSM_USDC,
          connectorTokens: [
            {
              decimals: 6,
              address: this.config.USDC,
            },
          ],
          liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
        },
        {
          exchange: this.dexKey,
          address: this.config.GSM_USDT,
          connectorTokens: [
            {
              decimals: 6,
              address: this.config.USDT,
            },
          ],
          liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
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

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
