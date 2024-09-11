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
  TransferFeeParams,
} from '../../types';
import INCEPTION_ABI from '../../abi/inception/inception-vault.json';
import INCEPTION_POOL_ABI from '../../abi/inception/inception-ineth-pool.json';
import {
  DEST_TOKEN_PARASWAP_TRANSFERS,
  Network,
  NULL_ADDRESS,
  SRC_TOKEN_PARASWAP_TRANSFERS,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { InceptionDexData, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { InceptionConfig, InceptionPricePoolConfig } from './config';
import { getTokenFromAddress, setTokensOnNetwork } from './tokens';
import { getOnChainState, getTokenList } from './utils';
import { InceptionEventPool } from './inception-event-pool';
import { applyTransferFee } from '../../lib/token-transfer-fee';
import { RETURN_AMOUNT_POS_0 } from '../../executor/constants';

const DECIMALS = BigInt(1e18);

export class Inception
  extends SimpleExchange
  implements IDex<InceptionDexData>
{
  protected vaultInterface: Interface;
  protected poolInterface: Interface;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(InceptionConfig);

  logger: Logger;

  private eventPool: InceptionEventPool;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected config = InceptionConfig[dexKey][network],
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
      InceptionPricePoolConfig[dexKey][network].ratioFeed,
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
    transferFees: TransferFeeParams = {
      srcFee: 0,
      destFee: 0,
      srcDexFee: 0,
      destDexFee: 0,
    },
  ): Promise<null | ExchangePrices<InceptionDexData>> {
    if (side === SwapSide.BUY) {
      return null;
    }

    const src = getTokenFromAddress(this.network, srcToken.address);
    const dest = getTokenFromAddress(this.network, destToken.address);

    if (!src || !dest || src !== dest) {
      return null;
    }

    // TODO: Implement in both directions
    // only baseToken -> inception token swaps are supported
    if (src.baseToken.toLowerCase() !== srcToken.address.toLowerCase()) {
      return null;
    }

    const poolState = await this.getPoolState(this.eventPool, blockNumber);
    if (!poolState) return null;

    const unitPrice = DECIMALS;
    const prices = amounts.map(amount => {
      const ratio = poolState[src.symbol.toLowerCase()].ratio;
      return (ratio * amount) / DECIMALS;
    });

    const [unitPriceWithFee, ...pricesWithFee] = applyTransferFee(
      [unitPrice, ...prices],
      side,
      side === SwapSide.SELL ? transferFees.srcFee : transferFees.destFee,
      side === SwapSide.SELL
        ? SRC_TOKEN_PARASWAP_TRANSFERS
        : DEST_TOKEN_PARASWAP_TRANSFERS,
    );

    return [
      {
        prices: pricesWithFee,
        unit: unitPriceWithFee,
        gasCost: 120_000,
        exchange: this.dexKey,
        data: {
          exchange: dest.vault,
        },
        poolAddresses: [dest.vault],
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

    if (!dexParams) {
      throw new Error('Unknown token');
    }

    const isNative = dexParams.baseTokenSlug === 'ETH';
    let swapData;
    let dexFuncHasRecipient;
    let swappedAmountNotPresentInExchangeData;
    if (isNative) {
      swapData = this.poolInterface.encodeFunctionData('stake()', []);
      dexFuncHasRecipient = false;
      swappedAmountNotPresentInExchangeData = true;
    } else {
      swapData = this.vaultInterface.encodeFunctionData('deposit', [
        srcAmount,
        recipient,
      ]);
      dexFuncHasRecipient = true;
      swappedAmountNotPresentInExchangeData = false;
    }

    return {
      needWrapNative: false,
      dexFuncHasRecipient,
      exchangeData: swapData,
      targetExchange: dexParams.vault,
      swappedAmountNotPresentInExchangeData,
      // TODO: Implement
      returnAmountPos: undefined,
    };
  }

  async updatePoolState(): Promise<void> {}

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    await this.initializeTokens();

    const token = getTokenFromAddress(this.network, tokenAddress);

    if (token) {
      return [
        {
          liquidityUSD: 1e9,
          exchange: this.dexKey,
          address: token.vault,
          connectorTokens: [
            {
              address:
                tokenAddress.toLowerCase() === token.token.toLowerCase()
                  ? token.baseToken
                  : token.token,
              decimals: 1e18,
            },
          ],
        },
      ];
    }
    return [];
  }

  releaseResources(): AsyncOrSync<void> {}
}
