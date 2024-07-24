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
import { Context, IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ConcentratorArusdData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { ConcentratorArusdConfig, Adapters } from './config';
import { Interface } from '@ethersproject/abi';
import ArUSD_ABI from '../../abi/concentrator/arUSD.json';
import { extractReturnAmountPosition } from '../../executor/utils';
import { uint256ToBigInt } from '../../lib/decoders';

export class ConcentratorArusd
  extends SimpleExchange
  implements IDex<ConcentratorArusdData>
{
  static readonly arUSDIface = new Interface(ArUSD_ABI);

  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(ConcentratorArusdConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    const config = ConcentratorArusdConfig[dexKey][network];
    this.config = {
      rUSDAddress: config.rUSDAddress.toLowerCase(),
      arUSDAddress: config.arUSDAddress.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
  }

  is_arUSD(token: string) {
    return token.toLowerCase() === this.config.arUSDAddress;
  }

  is_rUSD(token: string) {
    return token.toLowerCase() === this.config.rUSDAddress;
  }

  is_arUSD_swap_token(srcToken: string, destToken: string) {
    if (this.is_rUSD(srcToken) && this.is_arUSD(destToken)) {
      return true;
    }
    if (this.is_arUSD(srcToken) && this.is_rUSD(destToken)) {
      return true;
    }
    return false;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!this.is_arUSD_swap_token(srcToken.address, destToken.address)) {
      return [];
    }
    return [this.dexKey];
  }
  async getAmountOut(
    _tokenIn: Address,
    _tokenOut: Address,
    _amountsIn: bigint[],
    blockNumber: number,
  ): Promise<bigint[]> {
    let data: bigint[] = _amountsIn;
    try {
      if (this.is_rUSD(_tokenIn)) {
        data = await Promise.all(
          _amountsIn.map(async _amountIn => {
            try {
              const readerCallData = [
                {
                  target: this.config.arUSDAddress,
                  callData: ConcentratorArusd.arUSDIface.encodeFunctionData(
                    'previewDeposit',
                    [_amountIn],
                  ),
                  decodeFunction: uint256ToBigInt,
                },
              ];
              const results =
                await this.dexHelper.multiWrapper.tryAggregate<bigint>(
                  true,
                  readerCallData,
                  blockNumber,
                );
              return BigInt(results[0].returnData);
            } catch (e) {
              this.logger.error(e);
              return BigInt(0n);
            }
          }),
        );
      }
      if (this.is_arUSD(_tokenIn) && this.is_rUSD(_tokenOut)) {
        data = await Promise.all(
          _amountsIn.map(async _amountIn => {
            try {
              const readerCallData = [
                {
                  target: this.config.arUSDAddress,
                  callData: ConcentratorArusd.arUSDIface.encodeFunctionData(
                    'previewRedeem',
                    [_amountIn],
                  ),
                  decodeFunction: uint256ToBigInt,
                },
              ];
              const results =
                await this.dexHelper.multiWrapper.tryAggregate<bigint>(
                  true,
                  readerCallData,
                  blockNumber,
                );
              return BigInt(results[0].returnData);
            } catch (e) {
              this.logger.error(e);
              return BigInt(0n);
            }
          }),
        );
      }
      return data;
    } catch (error) {
      return _amountsIn;
    }
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<ConcentratorArusdData>> {
    const isArUSDSwapToken = this.is_arUSD_swap_token(
      srcToken.address,
      destToken.address,
    );
    if (!isArUSDSwapToken) {
      return null;
    }
    const prices = await this.getAmountOut(
      srcToken.address,
      destToken.address,
      amounts,
      blockNumber,
    );

    // console.log('amounts---', amounts, prices);
    return [
      {
        unit: 1000000000000000000n,
        prices,
        data: {},
        poolAddresses: [this.config.arUSDAddress],
        exchange: this.dexKey,
        gasCost: 1000000,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<ConcentratorArusdData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: ConcentratorArusdData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = '0x';

    return {
      targetExchange: this.config.rUSDAddress,
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
    data: ConcentratorArusdData,
    side: SwapSide,
    context: Context,
    executorAddress: Address,
  ): Promise<DexExchangeParam> {
    const is_rUSD_src = this.is_rUSD(srcToken);
    const is_arUSD_src = this.is_arUSD(srcToken);
    const is_rUSD_dest = this.is_rUSD(destToken);
    const is_arUSD_dest = this.is_arUSD(destToken);

    if (is_rUSD_src && is_arUSD_dest) {
      const exchangeData = ConcentratorArusd.arUSDIface.encodeFunctionData(
        'deposit',
        [srcAmount, recipient],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: true,
        exchangeData,
        targetExchange: this.config.arUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          ConcentratorArusd.arUSDIface,
          'deposit',
          'shares',
        ),
      };
    }
    if (is_arUSD_src && is_rUSD_dest) {
      const exchangeData = ConcentratorArusd.arUSDIface.encodeFunctionData(
        'redeem',
        [srcAmount, recipient, executorAddress],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: true,
        exchangeData,
        targetExchange: this.config.arUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          ConcentratorArusd.arUSDIface,
          'redeem',
          'assets',
        ),
      };
    }
    throw new Error('LOGIC ERROR');
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [
      {
        exchange: this.dexKey,
        address: this.config.arUSDAddress,
        connectorTokens: [
          {
            decimals: 18,
            address: this.config.arUSDAddress,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }
}
