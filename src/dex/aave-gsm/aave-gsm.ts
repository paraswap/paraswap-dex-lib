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

import GSM_ABI from '../../abi/aave-gsm/Aave_GSM.json';
import { Interface } from '@ethersproject/abi';
import { MultiResult } from '../../lib/multi-wrapper';
import { BytesLike } from 'ethers';
import { generalDecoder, uint256ToBigInt } from '../../lib/decoders';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { erc20Iface } from '../../lib/tokens/utils';

export class AaveGsm extends SimpleExchange implements IDex<AaveGsmData> {
  static readonly gsmInterface = new Interface(GSM_ABI);

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
        gasCost: endpoint.indexOf('BuyAsset') > 0 ? 80000 : 74000,
        poolIdentifier: `${this.dexKey}_${target}`,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<AaveGsmData>): number | number[] {
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
      const endpoint = isSrcGho
        ? 'getAssetAmountForBuyAsset'
        : 'getAssetAmountForSellAsset';

      const calldata = {
        target: targetExchange,
        callData: AaveGsm.gsmInterface.encodeFunctionData(endpoint, [
          ghoAmount,
        ]),
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
      };

      const result = await this.dexHelper.multiWrapper.tryAggregate<{
        underlying: bigint;
        gho: bigint;
      }>(true, [calldata]);

      assetAmount = result[0].returnData.underlying.toString();
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
      const calldata = [
        {
          target: this.config.USDT,
          callData: erc20Iface.encodeFunctionData('balanceOf', [
            this.config.GSM_USDT,
          ]),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: this.config.USDC,
          callData: erc20Iface.encodeFunctionData('balanceOf', [
            this.config.GSM_USDC,
          ]),
          decodeFunction: uint256ToBigInt,
        },
      ];

      const result = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
        true,
        calldata,
      );

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
          liquidityUSD: +formatUnits(result[0].returnData, 6),
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
          liquidityUSD: +formatUnits(result[1].returnData, 6),
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
