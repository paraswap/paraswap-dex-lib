import { Address, DexExchangeParam, OptimalRate, TxObject } from './types';
import { BigNumber } from 'ethers';
import { ETHER_ADDRESS, NULL_ADDRESS, SwapSide } from './constants';
import { AbiCoder, Interface } from '@ethersproject/abi';
import { ethers } from 'ethers';
import AugustusV6ABI from './abi/augustus-v6/ABI.json';
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
import { ExecutorDetector } from './executor/ExecutorDetector';
import { ExecutorBytecodeBuilder } from './executor/ExecutorBytecodeBuilder';
const {
  utils: { hexlify, hexConcat, hexZeroPad },
} = ethers;

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
    bytecodeBuilder: ExecutorBytecodeBuilder,
    userAddress: string,
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
            _dest = forceUnwrap && !dex.needWrapNative ? _dest : wethAddress;
            wethWithdraw = BigInt(se.destAmount);
          }

          const destTokenIsWeth = _dest === wethAddress;

          const dexParams = await dex.getDexParam!(
            _src,
            _dest,
            _srcAmount,
            _destAmount,
            destTokenIsWeth || !isLastSwap || se.exchange === 'BalancerV2'
              ? bytecodeBuilder.getAddress()
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
      userAddress,
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
      bytecodeBuilder,
      userAddress,
    );

    const side = priceRoute.side;
    const isSell = side === SwapSide.SELL;

    const partnerAndFee = this.buildFeesV6({
      referrerAddress,
      partnerAddress,
      partnerFeePercent,
      takeSurplus,
      priceRoute,
    });

    const swapParams = [
      bytecodeBuilder.getAddress(),
      [
        priceRoute.srcToken,
        priceRoute.destToken,
        isSell ? priceRoute.srcAmount : minMaxAmount,
        isSell ? minMaxAmount : priceRoute.destAmount,
        isSell ? priceRoute.destAmount : priceRoute.srcAmount,
        hexConcat([
          hexZeroPad(uuidToBytes16(uuid), 16),
          hexZeroPad(hexlify(priceRoute.blockNumber), 16),
        ]),
        beneficiary,
      ],
      partnerAndFee,
      permit,
      bytecode,
    ];

    const encoder = (...params: any[]) =>
      this.augustusV6Interface.encodeFunctionData('swapExactAmountIn', params);

    return {
      encoder,
      params: swapParams,
    };
  }

  // TODO: Improve
  protected async _buildDirect(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    referrerAddress: Address | undefined,
    partnerAddress: Address,
    partnerFeePercent: string,
    takeSurplus: boolean,
    permit: string,
    uuid: string,
    beneficiary: Address,
  ) {
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100 ||
      priceRoute.bestRoute[0].swaps.length !== 1 ||
      priceRoute.bestRoute[0].swaps[0].swapExchanges.length !== 1 ||
      priceRoute.bestRoute[0].swaps[0].swapExchanges[0].percent !== 100
    )
      throw new Error(`DirectSwap invalid bestRoute`);

    const dexName = priceRoute.bestRoute[0].swaps[0].swapExchanges[0].exchange;
    if (!dexName) throw new Error(`Invalid dex name`);

    const dex = this.dexAdapterService.getTxBuilderDexByKey(dexName);
    if (!dex) throw new Error(`Failed to find dex : ${dexName}`);

    if (!dex.getDirectParamV6)
      throw new Error(
        `Invalid DEX: dex should have getDirectParamV6: ${dexName}`,
      );

    const swapExchange = priceRoute.bestRoute[0].swaps[0].swapExchanges[0];

    const srcAmount =
      priceRoute.side === SwapSide.SELL ? swapExchange.srcAmount : minMaxAmount;
    const destAmount =
      priceRoute.side === SwapSide.SELL
        ? minMaxAmount
        : swapExchange.destAmount;

    const expectedAmount =
      priceRoute.side === SwapSide.SELL
        ? priceRoute.destAmount
        : priceRoute.srcAmount;

    const partnerAndFee = this.buildFeesV6({
      referrerAddress,
      partnerAddress,
      partnerFeePercent,
      takeSurplus,
      priceRoute,
    });

    return dex.getDirectParamV6!(
      priceRoute.srcToken,
      priceRoute.destToken,
      srcAmount,
      destAmount,
      expectedAmount,
      swapExchange.data,
      priceRoute.side,
      permit,
      uuid,
      partnerAndFee,
      beneficiary,
      priceRoute.blockNumber,
      priceRoute.contractMethod,
    );
  }

  private buildFeesV6({
    referrerAddress,
    priceRoute,
    takeSurplus,
    partnerAddress,
    partnerFeePercent,
  }: {
    referrerAddress?: Address;
    partnerAddress: Address;
    partnerFeePercent: string;
    takeSurplus: boolean;
    priceRoute: OptimalRate;
  }) {
    const partnerAndFee = referrerAddress
      ? this.packPartnerAndFeeData(
          referrerAddress,
          encodeFeePercentForReferrer(priceRoute.side),
          takeSurplus,
          false,
          false,
        )
      : this.packPartnerAndFeeData(
          partnerAddress,
          partnerFeePercent,
          takeSurplus,
          false,
          false,
        );

    return partnerAndFee;
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

    let encoder: (...params: any[]) => string;
    let params: (string | string[])[];

    if (
      this.dexAdapterService.isDirectFunctionNameV6(priceRoute.contractMethod)
    ) {
      ({ encoder, params } = await this._buildDirect(
        priceRoute,
        minMaxAmount,
        referrerAddress,
        partnerAddress,
        partnerFeePercent,
        takeSurplus ?? false,
        permit || '0x',
        uuid,
        _beneficiary,
      ));
    } else {
      ({ encoder, params } = await this._build(
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
      ));
    }

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

  private packPartnerAndFeeData(
    partner: string,
    feePercent: string,
    takeSurplus: boolean,
    referral: boolean,
    skipWhitelistFlag: boolean,
  ): string {
    const partnerBigInt = BigNumber.from(partner).shl(96);
    let feePercentBigInt = BigNumber.from(feePercent);
    if (takeSurplus) {
      feePercentBigInt = feePercentBigInt.or(BigNumber.from(1).shl(95));
    }
    if (referral) {
      feePercentBigInt = feePercentBigInt.or(BigNumber.from(1).shl(94));
    }
    if (skipWhitelistFlag) {
      feePercentBigInt = feePercentBigInt.or(BigNumber.from(1).shl(93));
    }
    return partnerBigInt.or(feePercentBigInt).toString();
  }
}
