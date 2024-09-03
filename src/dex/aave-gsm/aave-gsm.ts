import { AsyncOrSync } from 'ts-essentials';
import { Contract } from 'web3-eth-contract';
import { Interface } from '@ethersproject/abi';
import { get } from 'lodash';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  NumberAsString,
  DexExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import GsmABI from '../../abi/aave-gsm/gsm.json';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { BI_POWS } from '../../bigint-constants';
import { SimpleExchange } from '../simple-exchange';
import { AaveGsmData, PoolState, PoolConfig } from './types';
import { AaveGsmConfig, Adapters } from './config';
import { AaveGsmEventPool } from './aave-gsm-pool';

const bigIntify = (b: any) => BigInt(b.toString());
const gsmInterface = new Interface(GsmABI);

const WAD = BI_POWS[18];

export async function getOnChainState(
  multiContract: Contract,
  poolConfigs: PoolConfig[],
  blockNumber: number | 'latest',
): Promise<PoolState[]> {
  const callData = poolConfigs
    .map(c => [
      {
        target: c.gsmAddress,
        callData: gsmInterface.encodeFunctionData('canSwap', []),
      },
      {
        target: c.gsmAddress,
        callData: gsmInterface.encodeFunctionData('getIsFrozen', []),
      },
      {
        target: c.gsmAddress,
        callData: gsmInterface.encodeFunctionData('getIsSeized', []),
      },
      {
        target: c.gsmAddress,
        callData: gsmInterface.encodeFunctionData('getAccruedFees', []),
      },
      {
        target: c.gsmAddress,
        callData: gsmInterface.encodeFunctionData('getAvailableLiquidity', []),
      },
      {
        target: c.gsmAddress,
        callData: gsmInterface.encodeFunctionData(
          'getAvailableUnderlyingExposure',
          [],
        ),
      },
      {
        target: c.gsmAddress,
        callData: gsmInterface.encodeFunctionData('getExposureCap', []),
      },
    ])
    .flat();

  const res = await multiContract.methods
    .aggregate(callData)
    .call({}, blockNumber);

  let i = 0;
  return poolConfigs.map(c => {
    const canSwap = gsmInterface.decodeFunctionResult(
      'canSwap',
      res.returnData[i++],
    )[0];
    const isFrozen = gsmInterface.decodeFunctionResult(
      'getIsFrozen',
      res.returnData[i++],
    )[0];
    const isSeized = gsmInterface.decodeFunctionResult(
      'getIsSeized',
      res.returnData[i++],
    )[0];
    const accruedFees = bigIntify(
      gsmInterface.decodeFunctionResult(
        'getAccruedFees',
        res.returnData[i++],
      )[0],
    );
    const availableUnderlyingLiquidity = bigIntify(
      gsmInterface.decodeFunctionResult(
        'getAvailableLiquidity',
        res.returnData[i++],
      )[0],
    );
    const availableUnderlyingExposure = bigIntify(
      gsmInterface.decodeFunctionResult(
        'getAvailableUnderlyingExposure',
        res.returnData[i++],
      )[0],
    );
    const exposureCapUnderlying = bigIntify(
      gsmInterface.decodeFunctionResult(
        'getExposureCap',
        res.returnData[i++],
      )[0],
    );
    return {
      canSwap,
      isFrozen,
      isSeized,
      accruedFees,
      availableUnderlyingLiquidity,
      availableUnderlyingExposure,
      exposureCapUnderlying,
    };
  });
}

export class AaveGsm extends SimpleExchange implements IDex<AaveGsmData> {
  protected eventPools: { [underlyingAddress: string]: AaveGsmEventPool };

  readonly hasConstantPriceLargeAmounts = false;
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
    protected gho: Token = AaveGsmConfig[dexKey][network].gho,
    protected poolConfigs: PoolConfig[] = AaveGsmConfig[dexKey][network].pools,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = {};
    poolConfigs.forEach(
      p =>
        (this.eventPools[p.underlying.address.toLowerCase()] =
          new AaveGsmEventPool(dexKey, network, dexHelper, this.logger, p)),
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    const poolStates = await getOnChainState(
      this.dexHelper.multiContract,
      this.poolConfigs,
      blockNumber,
    );
    await Promise.all(
      this.poolConfigs.map(async (p, i) => {
        const eventPool = this.eventPools[p.underlying.address.toLowerCase()];
        await eventPool.initialize(blockNumber, {
          state: poolStates[i],
        });
      }),
    );
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side];
  }

  getEventPool(srcToken: Token, destToken: Token): AaveGsmEventPool | null {
    const srcAddress = srcToken.address.toLowerCase();
    const destAddress = destToken.address.toLowerCase();
    return (
      (srcAddress === this.gho.address && this.eventPools[destAddress]) ||
      (destAddress === this.gho.address && this.eventPools[srcAddress]) ||
      null
    );
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
    const eventPool = this.getEventPool(srcToken, destToken);
    if (!eventPool) return [];
    return [eventPool.getIdentifier()];
  }

  async getPoolState(
    pool: AaveGsmEventPool,
    blockNumber: number,
  ): Promise<PoolState> {
    const eventState = pool.getState(blockNumber);
    if (eventState) return eventState;
    const onChainState = await pool.generateState(blockNumber);
    pool.setState(onChainState, blockNumber);
    return onChainState;
  }

  // Using GHO to buy asset
  async getGhoAmountForBuyAsset(
    amounts: bigint[],
    address: string,
    blockNumber: number,
  ): Promise<bigint[]> {
    const results = await Promise.all(
      amounts.map(async a => {
        const data: { returnData: any } =
          await this.dexHelper.multiContract.methods
            .aggregate([
              {
                target: address,
                callData: gsmInterface.encodeFunctionData(
                  'getGhoAmountForBuyAsset',
                  [a],
                ),
              },
            ])
            .call({}, blockNumber);

        // Should give total amount of GHO user sells
        const decodedResult = gsmInterface.decodeFunctionResult(
          'getGhoAmountForBuyAsset',
          data.returnData,
        )[0][1];
        return bigIntify(decodedResult);
      }),
    );
    return results;
  }

  // Selling usdc/t to buy GHO
  async getGhoAmountForSellAsset(
    amounts: bigint[],
    address: string,
    blockNumber: number,
  ): Promise<bigint[]> {
    const results = await Promise.all(
      amounts.map(async a => {
        const data: { returnData: any[] } =
          await this.dexHelper.multiContract.methods
            .aggregate([
              {
                target: address,
                callData: gsmInterface.encodeFunctionData(
                  'getGhoAmountForSellAsset',
                  [a],
                ),
              },
            ])
            .call({}, blockNumber);

        // Decoding the result to get total usdc/t to sell
        const decodedResult = gsmInterface.decodeFunctionResult(
          'getGhoAmountForSellAsset',
          data.returnData,
        )[0][0];
        return bigIntify(decodedResult);
      }),
    );
    return results;
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
    const eventPool = this.getEventPool(srcToken, destToken);
    if (!eventPool) return null;

    const poolIdentifier = eventPool.getIdentifier();
    if (limitPools && !limitPools.includes(poolIdentifier)) return null;

    const poolState = await this.getPoolState(eventPool, blockNumber);

    // Exit if frozen or can't swap or seized
    if (!poolState.canSwap || poolState.isFrozen || poolState.isSeized)
      return null;

    const unitVolume = getBigIntPow(
      (side === SwapSide.SELL ? srcToken : destToken).decimals,
    );

    var prices: bigint[] = [];
    var unit = BigInt(0);

    // Figure out if we have USDC/USDT or GHO
    const haveGHO =
      (SwapSide.SELL && srcToken.address.toLowerCase() === this.gho.address) ||
      (SwapSide.BUY && destToken.address.toLowerCase() !== this.gho.address);

    // Using GHO to buy asset
    if (haveGHO && SwapSide.BUY) {
      const [unit, ...prices] = await this.getGhoAmountForBuyAsset(
        amounts,
        eventPool.poolConfig.gsmAddress,
        blockNumber,
      );
    } else if (haveGHO && SwapSide.SELL) {
      const [unit, ...prices] = await this.getGhoAmountForBuyAsset(
        amounts,
        eventPool.poolConfig.gsmAddress,
        blockNumber,
      );
    } else if (!haveGHO && SwapSide.BUY) {
      const [unit, ...prices] = await this.getGhoAmountForSellAsset(
        amounts,
        eventPool.poolConfig.gsmAddress,
        blockNumber,
      );
    }
    // Selling usdc/t to buy GHO
    else if (!haveGHO && SwapSide.SELL) {
      const [unit, ...prices] = await this.getGhoAmountForSellAsset(
        amounts,
        eventPool.poolConfig.gsmAddress,
        blockNumber,
      );
    }

    return [
      {
        prices,
        unit,
        data: {
          exchange: this.dexKey,
          assetAmount: amounts[0],
        },
        poolAddresses: [eventPool.poolConfig.gsmAddress],
        exchange: this.dexKey,
        gasCost: 200 * 1000, //TODO: simulate and fix the gas cost
        poolIdentifier,
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
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

  // TODO: Revisit for adding fees
  getGsmParams(
    srcToken: string,
    srcAmount: string,
    destAmount: string,
    data: AaveGsmData,
    side: SwapSide,
  ): { isUnderlyingSell: boolean; underlyingAmount: string } {
    // Note: underlying here refers to usdc/t
    const isSrcGho = srcToken.toLowerCase() === this.gho.address;
    const to18ConversionFactor = getBigIntPow(12); // 18 - 6
    if (side === SwapSide.SELL) {
      if (isSrcGho) {
        const underlyingAmt18 = BigInt(srcAmount) * WAD;
        return {
          isUnderlyingSell: false,
          underlyingAmount: (underlyingAmt18 / to18ConversionFactor).toString(),
        };
      } else {
        return { isUnderlyingSell: true, underlyingAmount: srcAmount };
      }
    } else {
      if (isSrcGho) {
        return { isUnderlyingSell: false, underlyingAmount: destAmount };
      } else {
        const underlyingAmt = BigInt(destAmount) * WAD;
        return {
          isUnderlyingSell: true,
          underlyingAmount: underlyingAmt.toString(),
        };
      }
    }
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: AaveGsmData,
    side: SwapSide,
  ): DexExchangeParam {
    const { isUnderlyingSell, underlyingAmount } = this.getGsmParams(
      srcToken,
      srcAmount,
      destAmount,
      data,
      side,
    );

    // Selling usdc/t => selling usdc/t to buy GHO => sellAsset()
    let exchangeData = gsmInterface.encodeFunctionData(
      isUnderlyingSell ? 'sellAsset' : 'buyAsset',
      [recipient, underlyingAmount],
    );

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange: data.exchange,
      spender: data.exchange,
      returnAmountPos: undefined,
    };
  }

  // (*TODO*) I think if the token is gho, should return min liquidity via getAvailableLiquidity() on both gsms
  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const _tokenAddress = tokenAddress.toLowerCase();
    const isGho = _tokenAddress === this.gho.address.toLowerCase();

    const validPoolConfigs = isGho
      ? this.poolConfigs
      : this.eventPools[_tokenAddress]
      ? [this.eventPools[_tokenAddress].poolConfig]
      : [];
    if (!validPoolConfigs.length) return [];

    const poolStates = await getOnChainState(
      this.dexHelper.multiContract,
      validPoolConfigs,
      'latest',
    );
    return validPoolConfigs.map((p, i) => ({
      exchange: this.dexKey,
      address: p.gsmAddress,
      liquidityUSD: parseInt(
        poolStates[i].availableUnderlyingLiquidity.toString(),
      ),
      connectorTokens: [isGho ? p.underlying : this.gho],
    }));
  }
}
