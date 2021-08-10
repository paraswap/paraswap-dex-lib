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
import { isETHAddress } from '../utils';
import { IWethDepositorWithdrawer, WethFunctions } from '../dex/weth';
import { OptimalSwap } from 'paraswap-core';
import { DexAdapterService } from '../dex';

type SimpleSwapParam = [ConstractSimpleData];

type PartialContractSimpleData = Pick<
  ConstractSimpleData,
  'callees' | 'exchangeData' | 'values' | 'startIndexes'
>;

export class SimpleSwap implements IRouter<SimpleSwapParam> {
  paraswapInterface: Interface;
  contractMethodName: string;

  constructor(
    protected dexAdapterService: DexAdapterService,
    adapters: Adapters,
  ) {
    this.paraswapInterface = new Interface(IParaswapABI);
    this.contractMethodName = 'simpleSwap';
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

  build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    partner: Address,
    feePercent: string,
    beneficiary: Address,
    permit: string,
    deadline: string,
  ): TxInfo<SimpleSwapParam> {
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100 ||
      priceRoute.bestRoute[0].swaps.length !== 1
    )
      throw new Error(`Simpleswap invalid bestRoute`);
    const swap = priceRoute.bestRoute[0].swaps[0];

    const { simpleExchangeDataList, srcAmountWeth, destAmountWeth } =
      swap.swapExchanges.reduce<{
        simpleExchangeDataList: SimpleExchangeParam[];
        srcAmountWeth: bigint;
        destAmountWeth: bigint;
      }>(
        (acc, se) => {
          const dex = this.dexAdapterService.getDexByKey(se.exchange);

          acc.simpleExchangeDataList.push(
            dex.getSimpleParam(
              swap.src,
              swap.dest,
              se.srcAmount,
              se.destAmount,
              se.data,
              SwapSide.SELL,
            ),
          );

          if (!dex.needWrapNative) return acc;

          if (isETHAddress(swap.src)) {
            acc.srcAmountWeth += BigInt(se.srcAmount);
          }

          if (isETHAddress(swap.dest)) {
            acc.destAmountWeth += BigInt(se.destAmount);
          }

          return acc;
        },
        {
          simpleExchangeDataList: [],
          srcAmountWeth: BigInt(0),
          destAmountWeth: BigInt(0),
        },
      );

    const simpleExchangeDataFlat = simpleExchangeDataList.reduce(
      (acc, se) => ({
        callees: acc.callees.concat(se.callees),
        calldata: acc.callees.concat(se.calldata),
        values: acc.callees.concat(se.values),
        networkFee: (BigInt(acc.networkFee) + BigInt(se.networkFee)).toString(),
      }),
      { callees: [], values: [], calldata: [], networkFee: '0' },
    );

    const maybeWethCallData = this.getDepositWithdrawWethCallData(
      srcAmountWeth,
      destAmountWeth,
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
      fromToken: priceRoute.src,
      toToken: priceRoute.dest,
      fromAmount: priceRoute.srcAmount,
      toAmount: minMaxAmount,
      expectedAmount: priceRoute.destAmount,
      beneficiary,
      partner,
      feePercent,
      permit,
      deadline,
    };

    const encoder = (...params: any[]) =>
      this.paraswapInterface.encodeFunctionData('simpleSwap', params);
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
    if (srcAmountWeth === BigInt('0') && destAmountWeth === BigInt('0')) return;

    return (
      this.dexAdapterService.getDexByKey(
        'weth',
      ) as unknown as IWethDepositorWithdrawer
    ).getDepositWithdrawParam(
      swap.src,
      swap.dest,
      srcAmountWeth.toString(),
      destAmountWeth.toString(),
      SwapSide.SELL,
    );
  }
}
