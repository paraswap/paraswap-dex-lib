import { Spark } from './spark';
import { Address, NumberAsString } from '@paraswap/core';
import { SparkData, SparkParams, SparkSUSDSPsmFunctions } from './types';
import { SwapSide } from '@paraswap/core/build/constants';
import { Context } from '../idex';
import { DexConfigMap, DexExchangeParam } from '../../types';
import { Network } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { Interface } from '@ethersproject/abi';
import SSRAuthOracleAbi from '../../abi/sdai/SSRAuthOracle.abi.json';
import SparkPSM3Abi from '../../abi/sdai/PSM3.abi.json';
import { IDexHelper } from '../../dex-helper';
import { Adapters } from './config';
import { extractReturnAmountPosition } from '../../executor/utils';

export const sUSDSPsmConfig: DexConfigMap<SparkParams> = {
  sUSDSPsm: {
    [Network.ARBITRUM]: {
      sdaiAddress: '0xdDb46999F8891663a8F2828d25298f70416d7610', // sUSDS
      daiAddress: '0x6491c05A82219b8D1479057361ff1654749b876b', // USDS
      potAddress: '0xEE2816c1E1eed14d444552654Ed3027abC033A36', // SSRAuthOracle contract address
      psmAddress: '0x2B05F8e1cACC6974fD79A673a341Fe1f58d27266', // PSM contract address
      savingsRate: {
        symbol: 'ssrOracle',
        topic:
          '0xc234856e2a0c5b406365714ced016892e7d98f7b1d49982cdd8db416a586d811', // SetSUSDSData event
      },
      poolInterface: new Interface(SSRAuthOracleAbi),
      exchangeInterface: new Interface(SparkPSM3Abi),
      swapFunctions: SparkSUSDSPsmFunctions,
      referralCode: '1004',
    },
    [Network.BASE]: {
      sdaiAddress: '0x5875eEE11Cf8398102FdAd704C9E96607675467a', // sUSDS
      daiAddress: '0x820C137fa70C8691f0e44Dc420a5e53c168921Dc', // USDS
      potAddress: '0x65d946e533748A998B1f0E430803e39A6388f7a1', // SSRAuthOracle contract address
      psmAddress: '0x1601843c5E9bC251A3272907010AFa41Fa18347E', // PSM contract address
      savingsRate: {
        symbol: 'ssrOracle',
        topic:
          '0x7373720000000000000000000000000000000000000000000000000000000000',
      },
      poolInterface: new Interface(SSRAuthOracleAbi),
      exchangeInterface: new Interface(SparkPSM3Abi),
      swapFunctions: SparkSUSDSPsmFunctions,
      referralCode: '1004',
    },
  },
};

export class sUSDSPsm extends Spark {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(sUSDSPsmConfig);

  constructor(
    protected network: Network,
    dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly config = sUSDSPsmConfig[dexKey][network],
    readonly daiAddress: string = sUSDSPsmConfig[dexKey][network].daiAddress,
    readonly sdaiAddress: string = sUSDSPsmConfig[dexKey][network].sdaiAddress,
    readonly potAddress: string = sUSDSPsmConfig[dexKey][network].potAddress,
    readonly abiInterface: Interface = sUSDSPsmConfig[dexKey][network]
      .poolInterface,

    protected adapters = Adapters[network] || {},
    protected sdaiInterface = sUSDSPsmConfig[dexKey][network].exchangeInterface,
    protected swapFunctions = sUSDSPsmConfig[dexKey][network].swapFunctions,
    protected referralCode = sUSDSPsmConfig[dexKey][network].referralCode,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      config,
      daiAddress,
      sdaiAddress,
      potAddress,
      abiInterface,
      adapters,
      sdaiInterface,
      swapFunctions,
      referralCode,
    );
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: SparkData,
    side: SwapSide,
    _: Context,
    executorAddress: Address,
  ): DexExchangeParam {
    const isSell = side === SwapSide.SELL;
    let swapData: string;

    if (isSell) {
      swapData = this.sdaiInterface.encodeFunctionData('swapExactIn', [
        srcToken,
        destToken,
        srcAmount,
        destAmount,
        recipient,
        this.config.referralCode,
      ]);
    } else {
      swapData = this.sdaiInterface.encodeFunctionData('swapExactOut', [
        srcToken,
        destToken,
        destAmount,
        srcAmount,
        recipient,
        this.config.referralCode,
      ]);
    }

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData: swapData,
      targetExchange: this.config.psmAddress!,
      returnAmountPos: isSell
        ? extractReturnAmountPosition(
            this.sdaiInterface,
            'swapExactIn',
            'amountOut',
          )
        : undefined,
    };
  }
}
