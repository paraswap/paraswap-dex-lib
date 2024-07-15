import { Interface, JsonFragment } from '@ethersproject/abi';
import { AsyncOrSync } from 'ts-essentials';
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
import { Adapters, InceptionConfig } from './config';
import { getTokenFromAddress, setTokensOnNetwork, Tokens } from './tokens';
import { fetchTokenList, getOnChainRatio, getOnChainState } from './utils';

const DECIMALS = BigInt(1e18);

export const TOKEN_LIST_CACHE_KEY = 'inceptionlrt-token-list';
const TOKEN_LIST_TTL_SECONDS = 24 * 60 * 60; // 1 day

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

  private state: Record<string, { blockNumber: number; ratio: bigint }> = {};

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
  }

  async initializePricing(blockNumber: number) {
    const poolState = await getOnChainState(
      this.dexHelper.multiContract,
      this.vaultInterface,
      this.network,
      blockNumber,
    );
    await this.initializeTokens(poolState, blockNumber);
  }

  async initializeTokens(poolState: PoolState, blockNumber: number) {
    let cachedTokenList = await this.dexHelper.cache.getAndCacheLocally(
      this.dexKey,
      this.network,
      TOKEN_LIST_CACHE_KEY,
      TOKEN_LIST_TTL_SECONDS,
    );

    if (cachedTokenList !== null) {
      if (Object.keys(Tokens).length !== 0) return;

      const tokenListParsed = JSON.parse(cachedTokenList);
      setTokensOnNetwork(this.network, tokenListParsed);

      tokenListParsed.forEach((p: DexParams) => {
        this.state[p.token] = {
          blockNumber,
          ratio: poolState[p.symbol.toLowerCase()].ratio,
        };
      });
      return;
    }

    let tokenList = await fetchTokenList(this.network);

    await this.dexHelper.cache.setexAndCacheLocally(
      this.dexKey,
      this.network,
      TOKEN_LIST_CACHE_KEY,
      TOKEN_LIST_TTL_SECONDS,
      JSON.stringify(tokenList),
    );

    setTokensOnNetwork(this.network, tokenList);

    // init state for all tokens as empty
    tokenList.forEach(p => {
      this.state[p.token] = {
        blockNumber,
        ratio: poolState[p.symbol.toLowerCase()].ratio,
      };
    });
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

    const [inceptionToken] = [src.token.toLowerCase()];

    if (
      !this.state[inceptionToken]?.blockNumber ||
      blockNumber > this.state[inceptionToken].blockNumber
    ) {
      const cached = await this.dexHelper.cache.get(
        this.dexKey,
        this.network,
        `state_${inceptionToken}`,
      );
      if (cached) {
        this.state[inceptionToken] = Utils.Parse(cached);
      } else {
        const ratio = await getOnChainRatio(
          this.dexHelper.multiContract,
          src.symbol === 'ETH' ? this.poolInterface : this.vaultInterface,
          this.network,
          src,
          blockNumber,
        );
        this.state[inceptionToken] = {
          blockNumber,
          ratio,
        };
        this.dexHelper.cache.setex(
          this.dexKey,
          this.network,
          `state_${inceptionToken}`,
          60,
          Utils.Serialize(this.state[inceptionToken]),
        );
      }
    }

    return [
      {
        prices: amounts.map(amount => {
          const ratio = this.state[inceptionToken].ratio;
          return (ratio * amount) / DECIMALS;
        }),
        unit: DECIMALS,
        gasCost: 120_000,
        exchange: this.dexKey,
        data: {
          exchange: dest.vault,
        },
        poolAddresses: [inceptionToken],
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
    return [];
  }

  releaseResources(): AsyncOrSync<void> {}
}
