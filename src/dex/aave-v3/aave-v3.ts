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
import { SwapSide, Network, NULL_ADDRESS } from '../../constants';
import { wrapETH, getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { Data, Param, PoolAndWethFunctions } from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, Config } from './config';

import WETH_GATEWAY_ABI_POLYGON from '../../abi/aave-v3/weth-gateway-polygon.json';
import WETH_GATEWAY_ABI_AVALANCHE from '../../abi/aave-v3/weth-gateway-avalanche.json';
import WETH_GATEWAY_ABI_FANTOM from '../../abi/aave-v3/weth-gateway-fantom.json';

import POOL_ABI from '../../abi/aave-v3/pool.json';
import { getATokenIfAaveV3Pair } from './tokens';

const pool: { [network: string]: string } = {
  [Network.MAINNET]: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  [Network.POLYGON]: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  [Network.AVALANCHE]: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
};

const WETH_GATEWAY: any = {
  [Network.FANTOM]: '0x17d013C19FE25cf4D911CE85eD5f40FE8880F46f',
  [Network.POLYGON]: '0x9BdB5fcc80A49640c7872ac089Cc0e00A98451B6',
  [Network.AVALANCHE]: '0xa938d8536aEed1Bd48f548380394Ab30Aa11B00E',
};

const WETH_GATEWAY_ABI: any = {
  [Network.FANTOM]: WETH_GATEWAY_ABI_FANTOM,
  [Network.POLYGON]: WETH_GATEWAY_ABI_POLYGON,
  [Network.AVALANCHE]: WETH_GATEWAY_ABI_AVALANCHE,
};

const REF_CODE = 1;

export class AaveV3 extends SimpleExchange implements IDex<Data, Param> {
  readonly hasConstantPriceLargeAmounts = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(Config);

  logger: Logger;

  private pool: Interface;
  private wethGateway: Interface;
  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected config = Config[dexKey][network],
    protected adapters = Adapters[network],
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.wethGateway = new Interface(WETH_GATEWAY_ABI[network]);
    this.pool = new Interface(POOL_ABI);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  private _getPoolIdentifier(srcToken: Token, destToken: Token): string {
    return (
      this.dexKey +
      [srcToken.address.toLowerCase(), destToken.address.toLowerCase()]
        .sort((a, b) => (a > b ? 1 : -1))
        .join('_')
    );
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const aToken = getATokenIfAaveV3Pair(
      this.network,
      wrapETH(srcToken, this.network),
      wrapETH(destToken, this.network),
    );

    if (aToken === null) return [];

    return [this._getPoolIdentifier(srcToken, destToken)];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<Data>> {
    const _src = wrapETH(srcToken, this.network);
    const _dst = wrapETH(destToken, this.network);

    const aToken = getATokenIfAaveV3Pair(this.network, _src, _dst);

    if (
      !aToken ||
      (limitPools &&
        !limitPools.includes(this._getPoolIdentifier(srcToken, destToken)))
    )
      return null;

    const fromAToken = aToken == _src;

    return [
      {
        prices: amounts,
        unit: BigInt(
          10 ** (side === SwapSide.SELL ? destToken : srcToken).decimals,
        ),
        gasCost: isETHAddress(srcToken.address)
          ? this.config.ethGasCost
          : this.config.lendingGasCost,
        exchange: this.dexKey,
        data: {
          isV3: true,
          fromAToken,
        },
        poolAddresses: [fromAToken ? srcToken.address : destToken.address],
      },
    ];
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const aToken = data.fromAToken ? srcToken : destToken; // Warning
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          aToken: 'address',
        },
      },
      { aToken: aToken },
    );

    return {
      // target exchange is not used by the contract
      targetExchange: NULL_ADDRESS,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const amount = side === SwapSide.SELL ? srcAmount : destAmount;
    const [Interface, swapCallee, swapFunction, swapFunctionParams] = ((): [
      Interface,
      Address,
      PoolAndWethFunctions,
      Param,
    ] => {
      if (isETHAddress(srcToken))
        return [
          this.wethGateway,
          WETH_GATEWAY[this.network],
          PoolAndWethFunctions.depositETH,
          [pool[this.network], this.augustusAddress, REF_CODE],
        ];

      if (isETHAddress(destToken))
        return [
          this.wethGateway,
          WETH_GATEWAY[this.network],
          PoolAndWethFunctions.withdrawETH,
          [pool[this.network], amount, this.augustusAddress],
        ];

      if (data.fromAToken) {
        return [
          this.pool,
          pool[this.network],
          PoolAndWethFunctions.withdraw,
          [destToken, amount, this.augustusAddress],
        ];
      }

      return [
        this.pool,
        pool[this.network],
        PoolAndWethFunctions.supply,
        [srcToken, amount, this.augustusAddress, REF_CODE],
      ];
    })();

    const swapData = Interface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      amount,
      destToken,
      destAmount,
      swapData,
      swapCallee,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }
}
