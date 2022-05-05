import { IRouter } from './irouter';
import {
  Address,
  Adapters,
  OptimalRate,
  ConstractSimpleData,
  TxInfo,
  SimpleExchangeParam,
} from '../types';
import { SwapSide } from '../constants';
import IParaswapABI from '../abi/IParaswap.json';
import { Interface } from '@ethersproject/abi';
import { isETHAddress, uuidToBytes16 } from '../utils';
import { Weth } from '../dex/weth/weth';
import { IWethDepositorWithdrawer, WethFunctions } from '../dex/weth/types';

import { OptimalSwap } from 'paraswap-core';
import { DexAdapterService } from '../dex';
import {
  encodeFeePercent,
  encodeFeePercentForReferrer,
} from './payload-encoder';

type SimpleSwapParam = [ConstractSimpleData];

type PartialContractSimpleData = Pick<
  ConstractSimpleData,
  'callees' | 'exchangeData' | 'values' | 'startIndexes'
>;

abstract class SimpleRouter implements IRouter<SimpleSwapParam> {
  paraswapInterface: Interface;
  contractMethodName: string;

  constructor(
    protected dexAdapterService: DexAdapterService,
    protected side: SwapSide,

    // prepare mapping: network -> wrapped exchange key
    // It assumes that no network has more than one wrapped exchange
    protected wExchangeNetworkToKey = Weth.dexKeysWithNetwork.reduce<
      Record<number, string>
    >((prev, current) => {
      for (const network of current.networks) {
        prev[network] = current.key;
      }
      return prev;
    }, {}),
  ) {
    this.paraswapInterface = new Interface(IParaswapABI);
    this.contractMethodName =
      side === SwapSide.SELL ? 'simpleSwap' : 'simpleBuy';
  }

  getContractMethodName(): string {
    return this.contractMethodName;
  }

  private buildPartialContractSimpleData(
    simpleExchangeParam: SimpleExchangeParam,
  ): PartialContractSimpleData {
    const calldata = simpleExchangeParam.calldata;
    let exchangeData = '0x';
    let startIndexes = [0];

    for (let i = 0; i < calldata.length; i++) {
      const tempCalldata = calldata[i].substring(2);
      const index = tempCalldata.length / 2;
      startIndexes.push(startIndexes[i] + index);
      exchangeData = exchangeData.concat(tempCalldata);
    }

    return {
      callees: simpleExchangeParam.callees,
      values: simpleExchangeParam.values,
      exchangeData,
      startIndexes,
    };
  }

  async build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    referrerAddress: Address | undefined,
    partnerAddress: Address,
    partnerFeePercent: string,
    positiveSlippageToUser: boolean,
    beneficiary: Address,
    permit: string,
    deadline: string,
    uuid: string,
  ): Promise<TxInfo<SimpleSwapParam>> {
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100 ||
      priceRoute.bestRoute[0].swaps.length !== 1
    )
      throw new Error(`Simpleswap invalid bestRoute`);
    const swap = priceRoute.bestRoute[0].swaps[0];

    const wethAddress = Weth.getAddress(priceRoute.network);

    const rawSimpleParams = await Promise.all(
      swap.swapExchanges.map(async se => {
        const dex = this.dexAdapterService.getTxBuilderDexByKey(se.exchange);
        let _src = swap.srcToken;
        let wethDeposit = 0n;
        let _dest = swap.destToken;
        let wethWithdraw = 0n;

        if (dex.needWrapNative) {
          if (isETHAddress(swap.srcToken)) {
            _src = wethAddress;
            wethDeposit = BigInt(se.srcAmount);
          }

          if (isETHAddress(swap.destToken)) {
            _dest = wethAddress;
            wethWithdraw = BigInt(se.destAmount);
          }
        }

        // For case of buy apply slippage is applied to srcAmount in equal proportion as the complete swap
        // This assumes that the sum of all swaps srcAmount would sum to priceRoute.srcAmount
        // Also that it is is direct swap.
        const _srcAmount =
          this.side === SwapSide.SELL
            ? se.srcAmount
            : (
                (BigInt(se.srcAmount) * BigInt(minMaxAmount)) /
                BigInt(priceRoute.srcAmount)
              ).toString();

        // In case of sell the destAmount is set to minimum (1) as
        // even if the individual dex is rekt by slippage the swap
        // should work if the final slippage check passes.
        const _destAmount = this.side === SwapSide.SELL ? '1' : se.destAmount;

        const simpleParams = await dex.getSimpleParam(
          _src,
          _dest,
          _srcAmount,
          _destAmount,
          se.data,
          this.side,
        );

        return {
          simpleParams,
          wethDeposit,
          wethWithdraw,
        };
      }),
    );

    const {
      simpleExchangeDataList,
      srcAmountWethToDeposit,
      destAmountWethToWithdraw,
    } = await rawSimpleParams.reduce<{
      simpleExchangeDataList: SimpleExchangeParam[];
      srcAmountWethToDeposit: bigint;
      destAmountWethToWithdraw: bigint;
    }>(
      (acc, se) => {
        acc.srcAmountWethToDeposit += BigInt(se.wethDeposit);
        acc.destAmountWethToWithdraw += BigInt(se.wethWithdraw);
        acc.simpleExchangeDataList.push(se.simpleParams);
        return acc;
      },
      {
        simpleExchangeDataList: [],
        srcAmountWethToDeposit: 0n,
        destAmountWethToWithdraw: 0n,
      },
    );

    const simpleExchangeDataFlat = simpleExchangeDataList.reduce(
      (acc, se) => ({
        callees: acc.callees.concat(se.callees),
        calldata: acc.calldata.concat(se.calldata),
        values: acc.values.concat(se.values),
        networkFee: (BigInt(acc.networkFee) + BigInt(se.networkFee)).toString(),
      }),
      { callees: [], values: [], calldata: [], networkFee: '0' },
    );

    const maybeWethCallData = this.getDepositWithdrawWethCallData(
      srcAmountWethToDeposit,
      destAmountWethToWithdraw,
      swap,
    );

    if (maybeWethCallData) {
      if (maybeWethCallData.opType === WethFunctions.deposit) {
        simpleExchangeDataFlat.callees.unshift(maybeWethCallData.callee);
        simpleExchangeDataFlat.values.unshift(maybeWethCallData.value);
        simpleExchangeDataFlat.calldata.unshift(maybeWethCallData.calldata);
      } else {
        simpleExchangeDataFlat.callees.push(maybeWethCallData.callee);
        simpleExchangeDataFlat.values.push(maybeWethCallData.value);
        simpleExchangeDataFlat.calldata.push(maybeWethCallData.calldata);
      }
    }

    const partialContractSimpleData = this.buildPartialContractSimpleData(
      simpleExchangeDataFlat,
    );

    const sellData: ConstractSimpleData = {
      ...partialContractSimpleData,
      fromToken: priceRoute.srcToken,
      toToken: priceRoute.destToken,
      fromAmount:
        this.side === SwapSide.SELL ? priceRoute.srcAmount : minMaxAmount,
      toAmount:
        this.side === SwapSide.SELL ? minMaxAmount : priceRoute.destAmount,
      expectedAmount:
        this.side === SwapSide.SELL
          ? (
              (BigInt(priceRoute.destAmount) * BigInt(95)) /
              BigInt(100)
            ).toString()
          : priceRoute.srcAmount,
      beneficiary,
      partner: referrerAddress || partnerAddress,
      feePercent: referrerAddress
        ? encodeFeePercentForReferrer(this.side)
        : encodeFeePercent(
            partnerFeePercent,
            positiveSlippageToUser,
            this.side,
          ),
      permit,
      deadline,
      uuid: uuidToBytes16(uuid),
    };

    const encoder = (...params: any[]) =>
      this.paraswapInterface.encodeFunctionData(
        this.contractMethodName,
        params,
      );
    // TODO: fix network fee
    return {
      encoder,
      params: [sellData],
      networkFee: simpleExchangeDataFlat.networkFee,
    };
  }

  getDepositWithdrawWethCallData(
    srcAmountWeth: bigint,
    destAmountWeth: bigint,
    swap: OptimalSwap,
  ) {
    if (srcAmountWeth === 0n && destAmountWeth === 0n) return;

    return (
      this.dexAdapterService.getTxBuilderDexByKey(
        this.wExchangeNetworkToKey[this.dexAdapterService.network],
      ) as unknown as IWethDepositorWithdrawer
    ).getDepositWithdrawParam(
      swap.srcToken,
      swap.destToken,
      srcAmountWeth.toString(),
      destAmountWeth.toString(),
      SwapSide.SELL,
    );
  }
}

export class SimpleSwap extends SimpleRouter {
  static isBuy = false;
  constructor(dexAdapterService: DexAdapterService) {
    super(dexAdapterService, SwapSide.SELL);
  }
}

export class SimpleBuy extends SimpleRouter {
  static isBuy = true;
  constructor(dexAdapterService: DexAdapterService) {
    super(dexAdapterService, SwapSide.BUY);
  }
}
