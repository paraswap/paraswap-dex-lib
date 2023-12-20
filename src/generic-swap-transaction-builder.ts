import { Address, DexExchangeParam, OptimalRate, TxObject } from './types';
import { ETHER_ADDRESS, NULL_ADDRESS, SwapSide } from './constants';
import { AbiCoder, Interface } from '@ethersproject/abi';
import AugustusV6ABI from './abi/AugustusV6.abi.json';
import {
  encodeFeePercent,
  encodeFeePercentForReferrer,
  encodePartnerAddressForFeeLogic,
} from './router/payload-encoder';
import { isETHAddress, uuidToBytes16 } from './utils';
import { IWethDepositorWithdrawer } from './dex/weth/types';
import { DexAdapterService } from './dex';
import { Weth } from './dex/weth/weth';
import ERC20ABI from './abi/erc20.json';
import { ExecutorDetector, Executors } from './executor/ExecutorDetector';
import { ExecutorBytecodeBuilder } from './executor/ExecutorBytecodeBuilder';

export class GenericSwapTransactionBuilder {
  augustusV6Interface: Interface;

  erc20Interface: Interface;

  abiCoder: AbiCoder;

  executorDetector: ExecutorDetector;

  constructor(
    protected dexAdapterService: DexAdapterService,
    protected wExchangeNetworkToKey = Weth.dexKeysWithNetwork.reduce<
      Record<number, string>
    >((prev, current) => {
      for (const network of current.networks) {
        prev[network] = current.key;
      }
      return prev;
    }, {}),
  ) {
    this.abiCoder = new AbiCoder();
    this.erc20Interface = new Interface(ERC20ABI);
    this.augustusV6Interface = new Interface(AugustusV6ABI);

    this.executorDetector = new ExecutorDetector(
      this.dexAdapterService.dexHelper,
    );
  }

  protected getDepositWithdrawWethCallData(
    srcAmountWeth: bigint,
    destAmountWeth: bigint,
    side: SwapSide,
  ) {
    if (srcAmountWeth === 0n && destAmountWeth === 0n) return;

    return (
      this.dexAdapterService.getTxBuilderDexByKey(
        this.wExchangeNetworkToKey[this.dexAdapterService.network],
      ) as unknown as IWethDepositorWithdrawer
    ).getDepositWithdrawParam(
      srcAmountWeth.toString(),
      destAmountWeth.toString(),
      side,
    );
  }

  protected buildFees(
    referrerAddress: string | undefined,
    partnerAddress: string,
    partnerFeePercent: string,
    takeSurplus: boolean,
    side: SwapSide,
  ): [string, string] {
    const [partner, feePercent] = referrerAddress
      ? [referrerAddress, encodeFeePercentForReferrer(side)]
      : [
          encodePartnerAddressForFeeLogic({
            partnerAddress,
            partnerFeePercent,
            takeSurplus,
          }),
          encodeFeePercent(partnerFeePercent, takeSurplus, side),
        ];

    return [partner, feePercent];
  }

  protected async buildCalls(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    executorName: Executors,
    bytecodeBuilder: ExecutorBytecodeBuilder,
  ): Promise<string> {
    const side = priceRoute.side;
    const wethAddress =
      this.dexAdapterService.dexHelper.config.data.wrappedNativeTokenAddress;

    const isMultiSwap = priceRoute.bestRoute[0].swaps.length > 1;
    const rawDexParams = await Promise.all(
      priceRoute.bestRoute[0].swaps.flatMap((swap, swapIndex) =>
        swap.swapExchanges.map(async se => {
          const dex = this.dexAdapterService.getTxBuilderDexByKey(se.exchange);
          let _src = swap.srcToken;
          let wethDeposit = 0n;
          let _dest = swap.destToken;
          let wethWithdraw = 0n;
          const isLastSwap =
            swapIndex === priceRoute.bestRoute[0].swaps.length - 1;

          // For case of buy apply slippage is applied to srcAmount in equal proportion as the complete swap
          // This assumes that the sum of all swaps srcAmount would sum to priceRoute.srcAmount
          // Also that it is a direct swap.
          const _srcAmount =
            swapIndex > 0 ||
            side === SwapSide.SELL ||
            this.dexAdapterService.getDexKeySpecial(se.exchange) === 'zerox'
              ? se.srcAmount
              : (
                  (BigInt(se.srcAmount) * BigInt(minMaxAmount)) /
                  BigInt(priceRoute.srcAmount)
                ).toString();

          // In case of sell the destAmount is set to minimum (1) as
          // even if the individual dex is rekt by slippage the swap
          // should work if the final slippage check passes.
          const _destAmount = side === SwapSide.SELL ? '1' : se.destAmount;

          if (isETHAddress(swap.srcToken) && dex.needWrapNative) {
            _src = wethAddress;
            wethDeposit = BigInt(_srcAmount);
          }

          const forceUnwrap =
            isETHAddress(swap.destToken) &&
            isMultiSwap &&
            !dex.needWrapNative &&
            !isLastSwap;
          if (
            (isETHAddress(swap.destToken) && dex.needWrapNative) ||
            forceUnwrap
          ) {
            _dest = wethAddress;
            wethWithdraw = BigInt(se.destAmount);
          }

          const destTokenIsWeth = _dest === wethAddress;

          const dexParams = await dex.getDexParam!(
            _src,
            _dest,
            _srcAmount,
            _destAmount,
            destTokenIsWeth || !isLastSwap
              ? this.executorDetector.getAddress(executorName)
              : this.dexAdapterService.dexHelper.config.data.augustusV6Address!,
            se.data,
            side,
          );

          return {
            dexParams,
            wethDeposit,
            wethWithdraw,
          };
        }),
      ),
    );

    const { exchangeParams, srcAmountWethToDeposit, destAmountWethToWithdraw } =
      await rawDexParams.reduce<{
        exchangeParams: DexExchangeParam[];
        srcAmountWethToDeposit: bigint;
        destAmountWethToWithdraw: bigint;
      }>(
        (acc, se) => {
          acc.srcAmountWethToDeposit += BigInt(se.wethDeposit);
          acc.destAmountWethToWithdraw += BigInt(se.wethWithdraw);
          acc.exchangeParams.push(se.dexParams);
          return acc;
        },
        {
          exchangeParams: [],
          srcAmountWethToDeposit: 0n,
          destAmountWethToWithdraw: 0n,
        },
      );

    const maybeWethCallData = this.getDepositWithdrawWethCallData(
      srcAmountWethToDeposit,
      destAmountWethToWithdraw,
      side,
    );

    return bytecodeBuilder.buildByteCode(
      priceRoute,
      exchangeParams,
      maybeWethCallData,
    );
  }

  protected async _build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    referrerAddress: Address | undefined,
    partnerAddress: Address,
    partnerFeePercent: string,
    takeSurplus: boolean,
    beneficiary: Address,
    permit: string,
    deadline: string,
    uuid: string,
  ) {
    const executorName =
      this.executorDetector.getExecutorByPriceRoute(priceRoute);
    const bytecodeBuilder =
      this.executorDetector.getBytecodeBuilder(executorName);
    const bytecode = await this.buildCalls(
      priceRoute,
      minMaxAmount,
      executorName,
      bytecodeBuilder,
    );

    const side = priceRoute.side;
    const isSell = side === SwapSide.SELL;
    const [partner, feePercent] = this.buildFees(
      referrerAddress,
      partnerAddress,
      partnerFeePercent,
      takeSurplus,
      side,
    );

    const swapParams = [
      this.executorDetector.getAddress(executorName),
      [
        priceRoute.srcToken,
        priceRoute.destToken,
        isSell ? priceRoute.srcAmount : minMaxAmount,
        isSell ? minMaxAmount : priceRoute.destAmount,
        isSell ? priceRoute.destAmount : priceRoute.srcAmount,
        deadline,
        uuidToBytes16(uuid),
        beneficiary,
      ],
      [partner, feePercent],
      permit,
      bytecode,
    ];

    const encoder = (...params: any[]) =>
      this.augustusV6Interface.encodeFunctionData('swap', params);

    return {
      encoder,
      params: swapParams,
    };
  }

  public async build({
    priceRoute,
    minMaxAmount,
    userAddress,
    referrerAddress,
    partnerAddress,
    partnerFeePercent,
    takeSurplus,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    permit,
    deadline,
    uuid,
    beneficiary,
    onlyParams = false,
  }: {
    priceRoute: OptimalRate;
    minMaxAmount: string;
    userAddress: Address;
    referrerAddress?: Address;
    partnerAddress: Address;
    partnerFeePercent: string;
    takeSurplus?: boolean;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    permit?: string;
    deadline: string;
    uuid: string;
    beneficiary?: Address;
    onlyParams?: boolean;
  }): Promise<TxObject> {
    const _beneficiary =
      beneficiary && beneficiary !== NULL_ADDRESS ? beneficiary : userAddress;

    const { encoder, params } = await this._build(
      priceRoute,
      minMaxAmount,
      userAddress,
      referrerAddress,
      partnerAddress,
      partnerFeePercent,
      takeSurplus ?? false,
      _beneficiary,
      permit || '0x',
      deadline,
      uuid,
    );

    const value = (
      priceRoute.srcToken.toLowerCase() === ETHER_ADDRESS.toLowerCase()
        ? BigInt(
            priceRoute.side === SwapSide.SELL
              ? priceRoute.srcAmount
              : minMaxAmount,
          )
        : BigInt(0)
    ).toString();

    return {
      from: userAddress,
      to: this.dexAdapterService.dexHelper.config.data.augustusV6Address,
      value,
      data: encoder.apply(null, params),
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  }
}
