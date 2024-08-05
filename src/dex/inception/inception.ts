import { Interface, JsonFragment } from '@ethersproject/abi';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { NumberAsString, SwapSide } from '@paraswap/core';
import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  ExchangePrices,
  Logger,
  PoolLiquidity,
  PoolPrices,
  Token,
} from '../../types';
import INCEPTION_ABI from '../../abi/inception/inception-vault.json';
import INCEPTION_POOL_ABI from '../../abi/inception/inception-ineth-pool.json';
import { Network, NULL_ADDRESS } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork, Utils } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams, InceptionDexData, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, InceptionConfig, InceptionPricePoolConfig } from './config';
import { getTokenFromAddress, setTokensOnNetwork, Tokens } from './tokens';
import { getOnChainState, getTokenList } from './utils';
import { InceptionEventPool } from './inception-event-pool';

const DECIMALS = BigInt(1e18);

export class Inception
  extends SimpleExchange
  implements IDex<InceptionDexData>
{
  protected vaultInterface: Interface;
  protected poolInterface: Interface;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(InceptionConfig);

  logger: Logger;

  private eventPool: InceptionEventPool;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected config = InceptionConfig[dexKey][network],
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.vaultInterface = new Interface(INCEPTION_ABI as JsonFragment[]);
    this.poolInterface = new Interface(INCEPTION_POOL_ABI as JsonFragment[]);
    this.eventPool = new InceptionEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
      {
        ratioFeedAddress: InceptionPricePoolConfig[dexKey][network].ratioFeed,
        initState: {},
      },
      this.poolInterface,
    );
  }

  async initializePricing(blockNumber: number) {
    const poolState = await getOnChainState(
      this.dexHelper.multiContract,
      this.vaultInterface,
      this.network,
      blockNumber,
    );

    await this.eventPool.initialize(blockNumber, {
      state: poolState,
    });
    await this.initializeTokens();
  }

  async initializeTokens() {
    let tokenList = await getTokenList(this.network);

    setTokensOnNetwork(this.network, tokenList);
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
    return [
      this.dexKey +
        '-' +
        [srcToken.address.toLowerCase(), destToken.address.toLowerCase()]
          .sort((a, b) => (a > b ? 1 : -1))
          .join('_'),
    ];
  }

  async getPoolState(
    pool: InceptionEventPool,
    blockNumber: number,
  ): Promise<PoolState> {
    const eventState = pool.getState(blockNumber);
    if (eventState) return eventState;
    const onChainState = await pool.generateState(blockNumber);
    pool.setState(onChainState, blockNumber);
    return onChainState;
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<InceptionDexData>> {
    const src = getTokenFromAddress(this.network, srcToken.address);
    const dest = getTokenFromAddress(this.network, destToken.address);

    if (src !== dest) {
      return null;
    }

    const poolState = await this.getPoolState(this.eventPool, blockNumber);
    if (!poolState) return null;

    return [
      {
        prices: amounts.map(amount => {
          const ratio = poolState[src.symbol.toLowerCase()].ratio;
          return (ratio * amount) / DECIMALS;
        }),
        unit: DECIMALS,
        gasCost: 120_000,
        exchange: this.dexKey,
        data: {
          exchange: dest.vault,
        },
        poolAddresses: [src.token.toLowerCase()],
      },
    ];
  }

  getCalldataGasCost(
    poolPrices: PoolPrices<InceptionDexData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_OVERHEAD + CALLDATA_GAS_COST.LENGTH_SMALL;
  }

  getAdapterParam(): AdapterExchangeParam {
    return {
      targetExchange: NULL_ADDRESS,
      payload: '0x',
      networkFee: '0',
    };
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: InceptionDexData,
    side: SwapSide,
  ): DexExchangeParam {
    const dexParams = getTokenFromAddress(this.network, srcToken);

    const isNative = dexParams.baseTokenSlug === 'ETH';
    let swapData;
    let dexFuncHasRecipient;
    if (isNative) {
      swapData = this.poolInterface.encodeFunctionData('stake()', []);
      dexFuncHasRecipient = false;
    } else {
      swapData = this.vaultInterface.encodeFunctionData('deposit', [
        srcAmount,
        recipient,
      ]);
      dexFuncHasRecipient = true;
    }

    return {
      needWrapNative: false,
      dexFuncHasRecipient,
      exchangeData: swapData,
      targetExchange: dexParams.vault,
      swappedAmountNotPresentInExchangeData: true,
      returnAmountPos: undefined,
    };
  }

  async updatePoolState(): Promise<void> {}

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    await this.initializeTokens();
    // TODO: Implement
    return [];
  }

  releaseResources(): AsyncOrSync<void> {}
}
