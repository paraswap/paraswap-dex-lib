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
  NumberAsString,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ConcentratorArusdData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { ConcentratorArusdConfig, Adapters } from './config';
import { Interface } from '@ethersproject/abi';
import ArUSD_ABI from '../../abi/concentrator/arUSD.json';
import { uint256ToBigInt } from '../../lib/decoders';
import { extractReturnAmountPosition } from '../../executor/utils';

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
      weETHAddress: config.weETHAddress.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
  }

  is_arUSD(token: string) {
    return token.toLowerCase() === this.config.arUSDAddress;
  }

  is_rUSD(token: string) {
    return token.toLowerCase() === this.config.rUSDAddress;
  }

  is_weETH(token: string) {
    return token.toLowerCase() === this.config.rUSDAddress;
  }

  is_arUSD_swap_token(srcToken: string, destToken: string) {
    if (this.is_rUSD(srcToken) && this.is_arUSD(destToken)) {
      return true;
    }
    if (this.is_arUSD(srcToken) && this.is_rUSD(destToken)) {
      return true;
    }
    if (this.is_arUSD(srcToken) && this.is_weETH(destToken)) {
      return true;
    }
    return false;
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
    if (!this.is_arUSD_swap_token(srcToken.address, destToken.address)) {
      return [];
    }
    return [this.dexKey];
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
  ): Promise<null | ExchangePrices<ConcentratorArusdData>> {
    const isArUSDSwapToken = this.is_arUSD_swap_token(
      srcToken.address,
      destToken.address,
    );
    if (!isArUSDSwapToken) {
      return null;
    }

    // const readerCallData = [
    //   {
    //     target: this.config.arUSDAddress,
    //     callData: ConcentratorArusd.arUSDIface.encodeFunctionData('nav'),
    //     decodeFunction: uint256ToBigInt,
    //   },
    // ];
    // const results = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
    //   true,
    //   readerCallData,
    //   blockNumber,
    // );
    return [
      {
        unit: 1000000000000000000n,
        prices: amounts,
        data: {},
        poolAddresses: [this.config.arUSDAddress],
        exchange: this.dexKey,
        gasCost: 70000,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<ConcentratorArusdData>,
  ): number | number[] {
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

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: ConcentratorArusdData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const is_rUSD_src = this.is_rUSD(srcToken);
    const is_arUSD_src = this.is_arUSD(srcToken);
    const is_rUSD_dest = this.is_rUSD(destToken);
    const is_arUSD_dest = this.is_arUSD(destToken);
    const is_weETH_dest = this.is_weETH(destToken);

    if (is_rUSD_src && is_arUSD_dest) {
      const approveParam = await this.getApproveSimpleParam(
        this.config.rUSDAddress,
        this.config.arUSDAddress,
        srcAmount,
      );
      return {
        callees: [...approveParam.callees, this.config.rUSDAddress],
        calldata: [
          ...approveParam.calldata,
          ConcentratorArusd.arUSDIface.encodeFunctionData('deposit', [
            srcAmount,
            this.augustusAddress,
          ]),
        ],
        values: [...approveParam.values, '0'],
        networkFee: '0',
      };
    }
    if (is_arUSD_src && is_rUSD_dest) {
      return {
        callees: [this.config.rUSDAddress],
        calldata: [
          ConcentratorArusd.arUSDIface.encodeFunctionData('redeem', [
            srcAmount,
            this.augustusAddress,
            this.augustusAddress,
          ]),
        ],
        values: ['0'],
        networkFee: '0',
      };
    }
    if (is_arUSD_src && is_weETH_dest) {
      return {
        callees: [this.config.rUSDAddress],
        calldata: [
          ConcentratorArusd.arUSDIface.encodeFunctionData('redeemToBaseToken', [
            srcAmount,
            this.augustusAddress,
            this.augustusAddress,
            0,
          ]),
        ],
        values: ['0'],
        networkFee: '0',
      };
    }
    throw new Error('LOGIC ERROR');
  }

  async getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: ConcentratorArusdData,
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    const is_rUSD_src = this.is_rUSD(srcToken);
    const is_arUSD_src = this.is_arUSD(srcToken);
    const is_rUSD_dest = this.is_rUSD(destToken);
    const is_arUSD_dest = this.is_arUSD(destToken);
    const is_weETH_dest = this.is_weETH(destToken);

    if (is_rUSD_src && is_arUSD_dest) {
      const exchangeData = ConcentratorArusd.arUSDIface.encodeFunctionData(
        'deposit',
        [srcAmount, this.augustusAddress],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
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
        [srcAmount, this.augustusAddress, this.augustusAddress],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
        exchangeData,
        targetExchange: this.config.rUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          ConcentratorArusd.arUSDIface,
          'redeem',
          'assets',
        ),
      };
    }
    if (is_arUSD_src && is_weETH_dest) {
      const exchangeData = ConcentratorArusd.arUSDIface.encodeFunctionData(
        'redeemToBaseToken',
        [srcAmount, this.augustusAddress, this.augustusAddress, 0],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
        exchangeData,
        targetExchange: this.config.rUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          ConcentratorArusd.arUSDIface,
          'redeemToBaseToken',
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
