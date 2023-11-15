import { Address, DexExchangeParam, OptimalRate, TxObject } from './types';
import { ETHER_ADDRESS, SwapSide } from './constants';
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
import { Executor01BytecodeBuilder } from './executor/Executor01BytecodeBuilder';

export class GenericSwapTransactionBuilder {
  augustusV6Interface: Interface;

  erc20Interface: Interface;

  abiCoder: AbiCoder;

  executor01BytecodeBuilder: Executor01BytecodeBuilder;

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
    this.executor01BytecodeBuilder = new Executor01BytecodeBuilder(
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

  protected getApproveERC20CallData(address: Address, srcAmount: string) {
    return this.erc20Interface.encodeFunctionData('approve', [
      address,
      srcAmount,
    ]);
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
    userAddress: Address,
  ): Promise<string> {
    const side = priceRoute.side;
    const wethAddress =
      this.dexAdapterService.dexHelper.config.data.wrappedNativeTokenAddress;

    const rawDexParams = await Promise.all(
      priceRoute.bestRoute[0].swaps.flatMap((swap, swapIndex) =>
        swap.swapExchanges.map(async se => {
          const dex = this.dexAdapterService.getTxBuilderDexByKey(se.exchange);
          let _src = swap.srcToken;
          let wethDeposit = 0n;
          let _dest = swap.destToken;
          let wethWithdraw = 0n;

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

          if (dex.needWrapNative) {
            if (isETHAddress(swap.srcToken)) {
              if (swapIndex !== 0) {
                throw new Error('Wrap native srcToken not in swapIndex 0');
              }
              _src = wethAddress;
              wethDeposit = BigInt(_srcAmount);
            }

            if (isETHAddress(swap.destToken)) {
              if (swapIndex !== priceRoute.bestRoute[0].swaps.length - 1) {
                throw new Error('Wrap native destToken not in swapIndex last');
              }
              _dest = wethAddress;
              wethWithdraw = BigInt(_destAmount);
            }
          }

          const dexParams = await dex.getDexParam!(
            _src,
            _dest,
            _srcAmount,
            _destAmount,
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

    const {
      simpleExchangeDataList,
      srcAmountWethToDeposit,
      destAmountWethToWithdraw,
    } = await rawDexParams.reduce<{
      simpleExchangeDataList: DexExchangeParam[];
      srcAmountWethToDeposit: bigint;
      destAmountWethToWithdraw: bigint;
    }>(
      (acc, se) => {
        acc.srcAmountWethToDeposit += BigInt(se.wethDeposit);
        acc.destAmountWethToWithdraw += BigInt(se.wethWithdraw);
        acc.simpleExchangeDataList.push(se.dexParams);
        return acc;
      },
      {
        simpleExchangeDataList: [],
        srcAmountWethToDeposit: 0n,
        destAmountWethToWithdraw: 0n,
      },
    );

    const maybeWethCallData = this.getDepositWithdrawWethCallData(
      srcAmountWethToDeposit,
      destAmountWethToWithdraw,
      side,
    );

    return this.executor01BytecodeBuilder.buildByteCode(
      priceRoute,
      simpleExchangeDataList,
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
    const bytecode = await this.buildCalls(
      priceRoute,
      minMaxAmount,
      userAddress,
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
      this.dexAdapterService.dexHelper.config.data.executorsAddresses![
        'Executor01'
      ],
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
    const _beneficiary = beneficiary || userAddress;
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
