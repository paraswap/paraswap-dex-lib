import { Interface } from '@ethersproject/abi';
import { ethers } from 'ethers';
import CSETH_ABI from '../../abi/ERC20.abi.json';
import CLAYMAIN_ABI from '../../abi/claystack/clayMain.json';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { ETHER_ADDRESS, Network, SwapSide } from '../../constants';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { IDex } from '../../dex/idex';
import { uint256ToBigInt } from '../../lib/decoders';
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
import { Utils, getDexKeysWithNetwork } from '../../utils';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, ClaystackConfig } from './config';
import { ClaystackData, DexParams, PoolState } from './types';

export class Claystack extends SimpleExchange implements IDex<ClaystackData> {
  static readonly csETHIface = new Interface(CSETH_ABI);
  static readonly clayMainIface = new Interface(CLAYMAIN_ABI);

  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;

  readonly needWrapNative = false;

  // There aren't actually fees on csETH currently but can be later updated
  readonly isFeeOnTransferSupported = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(ClaystackConfig);

  logger: Logger;

  private state: { blockNumber: number } & PoolState = {
    blockNumber: 0,
    exchangeRate: 0n,
  };

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    const config = ClaystackConfig[dexKey][network];
    this.config = {
      csETH: config.csETH.toLowerCase(),
      clayMain: config.clayMain.toLowerCase(),
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
      !(
        srcTokenAddress === this.config.csETH.toLowerCase() &&
        destTokenAddress === ETHER_ADDRESS.toLowerCase()
      )
    ) {
      return [];
    }
    return [this.dexKey + '_' + this.config.csETH];
  }

  protected calcExchangeRate = (amount: bigint): bigint =>
    (amount * this.state.exchangeRate) /
    ethers.constants.WeiPerEther.toBigInt();

  protected calcReverseExchangeRate = (amount: bigint): bigint =>
    (amount * ethers.constants.WeiPerEther.toBigInt()) /
    this.state.exchangeRate;

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
  ): Promise<null | ExchangePrices<ClaystackData>> {
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      !(
        srcTokenAddress === this.config.csETH.toLowerCase() &&
        destTokenAddress === ETHER_ADDRESS.toLowerCase()
      )
    ) {
      return null;
    }
    const cached = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      'state',
    );
    if (cached) {
      this.state = Utils.Parse(cached);
    }
    if (blockNumber > this.state.blockNumber) {
      const calls = [
        {
          target: this.config.clayMain,
          callData: Claystack.clayMainIface.encodeFunctionData(
            'getExchangeRate',
            [ethers.constants.WeiPerEther],
          ),
          decodeFunction: uint256ToBigInt,
        },
      ];
      const results = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
        true,
        calls,
        blockNumber,
      );
      this.state = {
        blockNumber,
        exchangeRate: results[0].returnData,
      };
      this.dexHelper.cache.setex(
        this.dexKey,
        this.network,
        'state',
        60,
        Utils.Serialize(this.state),
      );
    }

    const calc =
      srcToken.address.toLowerCase() === ETHER_ADDRESS.toLowerCase() &&
      destToken.address.toLowerCase() === this.config.csETH
        ? this.calcExchangeRate
        : this.calcReverseExchangeRate;
    return [
      {
        unit: calc(1000000000000000000n),
        prices: amounts.map(calc),
        data: {},
        poolAddresses: [this.config.csETH],
        exchange: this.dexKey,
        gasCost: 70000,
        poolIdentifier: this.dexKey,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    _poolPrices: PoolPrices<ClaystackData>,
  ): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
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
    data: ClaystackData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: this.config.clayMain,
      payload: '0x',
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
    data: ClaystackData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (
      srcToken.toLowerCase() === ETHER_ADDRESS.toLowerCase() &&
      destToken.toLowerCase() === this.config.csETH
    ) {
      return {
        callees: [this.config.clayMain],
        calldata: [Claystack.clayMainIface.encodeFunctionData('deposit', [])],
        values: [srcAmount],
        networkFee: '0',
      };
    } else {
      return {
        callees: [],
        calldata: [],
        values: ['0'],
        networkFee: '0',
      };
    }
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    tokenAddress = tokenAddress.toLowerCase();
    if (tokenAddress !== this.config.csETH.toLowerCase()) {
      return [];
    }
    return [
      {
        exchange: this.dexKey,
        address: this.config.csETH,
        connectorTokens: [
          {
            decimals: 18,
            address: this.config.csETH,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }
}
