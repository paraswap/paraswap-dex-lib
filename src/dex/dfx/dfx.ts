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
  ExchangeTxInfo,
  OptimalSwapExchange,
  PreprocessTransactionOptions,
  TxInfo,
} from '../../types';
import { SwapSide, Network, CACHE_PREFIX } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DFXV3OriginSwap, DfxData } from './types';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';
import { DfxConfig, Adapters } from './config';
import { DfxEventPool } from './dfx-pool';
import { Contract } from 'web3-eth-contract';
import CurvepoolABI from '../../abi/dfx/Curve-pool.json';
import RouterABI from '../../abi/dfx/Router.json';
import { AbiItem } from 'web3-utils';
import { UniswapV3Data } from '../uniswap-v3/types';
import { pack } from '@ethersproject/solidity';
import { Interface } from 'ethers/lib/utils';

export class Dfx extends SimpleExchange implements IDex<DfxData> {
  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(DfxConfig);

  private uniswapMulti: Contract;
  readonly dexKey: string;
  readonly cacheStateKey: any;

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexHelper: IDexHelper,
    dexKey: string,
    readonly routerIface = new Interface(RouterABI),
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    protected config = DfxConfig['DFXV3'][network], // protected poolsToPreload = PoolsToPreload[dexKey][network] || [],
  ) {
    super(dexHelper);
    this.dexKey = 'DFXV3';
    this.logger = dexHelper.getLogger('DFXV3' + '-' + network);
    this.uniswapMulti = new this.dexHelper.web3Provider.eth.Contract(
      CurvepoolABI as AbiItem[],
      DfxConfig['DFXV3'][network].curve,
    );

    // To receive revert reasons
    this.dexHelper.web3Provider.eth.handleRevert = false;
  }
  needsSequentialPreprocessing?: boolean | undefined;
  getNetworkFee?(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: DfxData,
    side: SwapSide,
  ): string {
    throw new Error('Method not implemented.');
  }
  preProcessTransaction?(
    optimalSwapExchange: OptimalSwapExchange<DfxData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): AsyncOrSync<[OptimalSwapExchange<DfxData>, ExchangeTxInfo]> {
    throw new Error('Method not implemented.');
  }
  getTokenFromAddress?(address: string): Token {
    throw new Error('Method not implemented.');
  }
  getDirectParam?(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    expectedAmount: string,
    data: DfxData,
    side: SwapSide,
    permit: string,
    uuid: string,
    feePercent: string,
    deadline: string,
    partner: string,
    beneficiary: string,
    contractMethod?: string | undefined,
  ): TxInfo<null> {
    throw new Error('Method not implemented.');
  }
  isStatePollingDex?: boolean | undefined;
  addMasterPool?(poolKey: string, blockNumber: number): AsyncOrSync<boolean> {
    throw new Error('Method not implemented.');
  }
  isBlacklisted?(userAddress?: string | undefined): AsyncOrSync<boolean> {
    throw new Error('Method not implemented.');
  }
  setBlacklist?(userAddress?: string | undefined): AsyncOrSync<boolean> {
    throw new Error('Method not implemented.');
  }
  updatePoolState?(): AsyncOrSync<void> {
    throw new Error('Method not implemented.');
  }
  private _sortTokens(srcAddress: Address, destAddress: Address) {
    return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
  }

  getPoolIdentifier(srcAddress: Address, destAddress: Address) {
    const tokenAddresses = this._sortTokens(srcAddress, destAddress).join('-');
    return `dfx-${tokenAddresses}_v3`;
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
    //await this.factory.initialize(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): null {
    return null;
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
    if (side === SwapSide.BUY) return [];

    const poolObj = Object.values(this.config.pools);
    return poolObj.map(pool => (pool?.id ? pool.id : '')); //@DEV can be done better
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
  ): Promise<null | ExchangePrices<DfxData>> {
    // TODO: complete me!
    const pools = Object.keys(this.config.pools);

    return [
      {
        prices: amounts,
        unit: getBigIntPow(18),

        gasCost: 1000,
        exchange: 'DFXV3',
        data: {
          path: [
            {
              tokenIn: srcToken.address,
              tokenOut: destToken.address,
              fee: '0.05',
            },
          ],
        },
        poolAddresses: pools,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<DfxData>): number | number[] {
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
    data: UniswapV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { path: rawPath } = data;
    const path = this._encodePath(rawPath);

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          path: 'bytes',
          deadline: 'uint256',
        },
      },
      {
        path,
        deadline: getLocalDeadlineAsFriendlyPlaceholder(), // FIXME: more gas efficient to pass block.timestamp in adapter
      },
    );

    return {
      targetExchange: this.config.router,
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
    data: DfxData,
    deadline: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!

    const path = this._encodePath(data.path);
    const swapFunctionParams: DFXV3OriginSwap = {
      _originAmount: srcAmount,
      _minTargetAmount: destAmount,
      _path: [path], //@DEV needs to be fixed
      _deadline: deadline,
    };
    const swapData = this.routerIface.encodeFunctionData('originSwap', [
      swapFunctionParams,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.router,
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!

    const poolObj = Object.values(this.config.pools);

    const poolLiquidityArray: PoolLiquidity[] = poolObj
      .filter(pool => pool !== undefined)
      .map(pool => ({
        exchange: 'DFX',
        address: pool!.id,
        connectorTokens: [{ address: pool!.tokens[1], decimals: 6 }],
        liquidityUSD: 0, // @DEV fix
      })) as PoolLiquidity[]; // Use type assertion to tell TypeScript that the array does not contain undefined values.

    return poolLiquidityArray;
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }

  private _encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
      fee: NumberAsString;
    }[],
  ): string {
    if (path.length === 0) {
      this.logger.error(` Received invalid path=${path}  to encode`);
      return '0x';
    }

    const { _path, types } = path.reduce(
      (
        { _path, types }: { _path: string[]; types: string[] },
        curr,
        index,
      ): { _path: string[]; types: string[] } => {
        if (index === 0) {
          return {
            types: ['address', 'uint24', 'address'],
            _path: [curr.tokenIn, curr.fee, curr.tokenOut],
          };
        } else {
          return {
            types: [...types, 'uint24', 'address'],
            _path: [..._path, curr.fee, curr.tokenOut],
          };
        }
      },
      { _path: [], types: [] },
    );

    return pack(types.reverse(), _path.reverse());
  }
}
