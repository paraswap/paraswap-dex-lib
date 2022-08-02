import { AbiCoder, Interface } from '@ethersproject/abi';
import { parseFixed } from '@ethersproject/bignumber';
import { DeepReadonly } from 'ts-essentials';
import { Token, Address, Log, Logger, BlockHeader } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { getBigIntPow } from '../../utils';
import PoolABI from '../../abi/maverick/pool.json';

import { IDexHelper } from '../../dex-helper/idex-helper';
import { MaverickPoolState } from './types';
import { MaverickPoolMath } from './maverick-math/maverick-pool-math';
import { BI_POWS } from '../../bigint-constants';
import { MMath } from './maverick-math/maverick-sol-math';

const coder = new AbiCoder();

export class MaverickEventPool extends StatefulEventSubscriber<MaverickPoolState> {
  poolDecoder: (log: Log) => any;
  public poolInterface: Interface;
  public poolMath: MaverickPoolMath;
  addressesSubscribed: string[];

  handlers: {
    [event: string]: (
      event: any,
      pool: MaverickPoolState,
      log: Log,
      blockHeader: BlockHeader,
    ) => MaverickPoolState;
  } = {};

  constructor(
    protected parentName: string,
    protected dexHelper: IDexHelper,
    public address: Address,
    public quote: Token,
    public base: Token,
    public fee: number,
    public w: number,
    public h: number,
    public k: number,
    public paramChoice: number,
    public twauLookback: number,
    public uShiftMultiplier: number,
    public maxSpreadFee: number,
    public spreadFeeMultiplier: number,
    public protocolFeeRatio: number,
    public epsilon: number,
    logger: Logger,
  ) {
    super(
      `${parentName} ${quote.symbol || quote.address}-${
        base.symbol || base.address
      }-${fee}-${w}-${h}`,
      logger,
    );

    this.poolInterface = new Interface(PoolABI);
    this.poolDecoder = (log: Log) => this.poolInterface.parseLog(log);
    this.handlers['Swap'] = this.handleSwap.bind(this);
    this.handlers['AddLiquidity'] = this.handleAddLiquidity.bind(this);
    this.handlers['RemoveLiquidity'] = this.handleRemoveLiquidity.bind(this);
    this.addressesSubscribed = [address];
    this.poolMath = new MaverickPoolMath(
      parentName,
      parseFixed(epsilon.toString(), 18).toBigInt(),
      parseFixed(fee.toString(), 18).toBigInt(),
      parseFixed(protocolFeeRatio.toString(), 18).toBigInt(),
      parseFixed(spreadFeeMultiplier.toString(), 18).toBigInt(),
      BigInt(twauLookback),
      parseFixed(uShiftMultiplier.toString(), 18).toBigInt(),
      parseFixed(w.toString(), 18).toBigInt(),
      parseFixed(k.toString(), 18).toBigInt(),
      parseFixed(h.toString(), 18).toBigInt(),
    );
  }

  protected processLog(
    state: DeepReadonly<MaverickPoolState>,
    log: Readonly<Log>,
    blockHeader: BlockHeader,
  ): DeepReadonly<MaverickPoolState> | null {
    const event = this.poolDecoder(log);
    if (event.name in this.handlers) {
      return this.handlers[event.name](event, state, log, blockHeader);
    }
    return state;
  }

  handleSwap(
    event: any,
    state: MaverickPoolState,
    log: Log,
    blockHeader: BlockHeader,
  ): MaverickPoolState {
    let amountIn = event.args.amountIn.toBigInt();
    this.poolMath.swap(
      state,
      BigInt(blockHeader.timestamp),
      amountIn,
      event.args.swapForBase,
    );
    return state;
  }

  handleAddLiquidity(
    event: any,
    state: MaverickPoolState,
    log: Log,
    blockHeader: BlockHeader,
  ): MaverickPoolState {
    state.quoteBalance += event.args.quoteAmount.toBigInt();
    state.baseBalance += event.args.baseAmount.toBigInt();
    if (state.u == 0n) {
      state.u = MMath.div(state.quoteBalance, state.baseBalance);
      state.twau = state.u;
      state.lastTimestamp = BigInt(blockHeader.timestamp);
    }
    return state;
  }

  handleRemoveLiquidity(
    event: any,
    state: MaverickPoolState,
    log: Log,
    blockHeader: BlockHeader,
  ): MaverickPoolState {
    const quoteAmount = event.args.quoteAmount.toBigInt();
    const baseAmount = event.args.baseAmount.toBigInt();
    (state.quoteBalance -= quoteAmount), this.quote;
    (state.baseBalance -= baseAmount), this.base;
    return state;
  }

  scaleFromAmount(amount: bigint, token: Token) {
    if (token.decimals > 18) {
      const scalingFactor: bigint =
        BI_POWS[18] * getBigIntPow(token.decimals - 18);
      return MMath.sDivDownFixed(amount, scalingFactor);
    } else {
      const scalingFactor: bigint =
        BI_POWS[18] * getBigIntPow(18 - token.decimals);
      return MMath.sMulUpFixed(amount, scalingFactor);
    }
  }

  scaleToAmount(amount: bigint, token: Token) {
    if (token.decimals > 18) {
      const scalingFactor: bigint =
        BI_POWS[18] * getBigIntPow(token.decimals - 18);
      return MMath.sMulUpFixed(amount, scalingFactor);
    } else {
      const scalingFactor: bigint =
        BI_POWS[18] * getBigIntPow(18 - token.decimals);
      return MMath.sDivDownFixed(amount, scalingFactor);
    }
  }

  swap(amount: bigint, from: Token, to: Token) {
    const scaledAmount = this.scaleFromAmount(amount, from);
    const output = this.poolMath.swap(
      { ...this.state! },
      0n,
      scaledAmount,
      from.address.toLowerCase() == this.quote.address.toLowerCase(),
    );
    return this.scaleToAmount(output, to);
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<MaverickPoolState>> {
    let calldata = [
      {
        target: this.address,
        callData: this.poolInterface.encodeFunctionData('quoteBalance', []),
      },
      {
        target: this.address,
        callData: this.poolInterface.encodeFunctionData('baseBalance', []),
      },
      {
        target: this.address,
        callData: this.poolInterface.encodeFunctionData('u', []),
      },
      {
        target: this.address,
        callData: this.poolInterface.encodeFunctionData(
          'getTwapParameters',
          [],
        ),
      },
    ];

    const data = await this.dexHelper.multiContract.methods
      .aggregate(calldata)
      .call({}, blockNumber);

    return {
      quoteBalance: coder.decode(['int128'], data.returnData[0])[0].toBigInt(),
      baseBalance: coder.decode(['int128'], data.returnData[1])[0].toBigInt(),
      u: coder.decode(['int256'], data.returnData[2])[0].toBigInt(),
      lastTimestamp: BigInt(
        coder.decode(['int32', 'int224'], data.returnData[3])[0],
      ),
      twau: coder.decode(['int32', 'int224'], data.returnData[3])[1].toBigInt(),
    };
  }
}
