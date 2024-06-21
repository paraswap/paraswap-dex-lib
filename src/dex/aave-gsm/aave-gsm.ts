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
} from '../../types';
import { Contract } from 'web3-eth-contract';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AaveGsmData, PoolState, PoolConfig } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AaveGsmConfig, Adapters } from './config';
import { AaveGsmEventPool } from './aave-gsm-pool';
import { Interface } from '@ethersproject/abi';
import GsmABI from '../../abi/aave-gsm/gsm.json';

const bigIntify = (b: any) => BigInt(b.toString());
const gsmInterface = new Interface(GsmABI);

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
    protected poolConfigs: PoolConfig[] = AaveGsmConfig[dexKey][network].pools,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = {};
    poolConfigs.forEach(
      p =>
        (this.eventPools[p.underlyingAddress.toLowerCase()] =
          new AaveGsmEventPool(dexKey, network, dexHelper, this.logger, p)),
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
    const poolStates = await getOnChainState(
      this.dexHelper.multiContract,
      this.poolConfigs,
      blockNumber,
    );
    await Promise.all(
      this.poolConfigs.map(async (p, i) => {
        const eventPool = this.eventPools[p.gem.address.toLowerCase()];
        await eventPool.initialize(blockNumber, {
          state: poolStates[i],
        });
      }),
    );
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
    // TODO: complete me!
    return [];
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
    // TODO: complete me!
    return null;
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

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!
    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
