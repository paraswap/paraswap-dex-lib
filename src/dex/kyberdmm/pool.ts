import { AbiCoder, Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import kyberDmmPoolABI from '../../abi/kyberdmm/kyber-dmm-pool.abi.json';
import { getFee, getRFactor } from './fee-formula';
import { KyberDmmAbiEvents, TradeInfo } from './types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, BlockHeader, Log, Logger, Token } from '../../types';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { BI_POWS } from '../../bigint-constants';

export type KyberDmmPools = { [poolAddress: string]: KyberDmmPool };

export type KyberDmmPair = {
  token0: Token;
  token1: Token;
  exchanges: Address[];
  pools: KyberDmmPools;
};

export interface KyberDmmPoolState {
  reserves: {
    reserves0: bigint;
    reserves1: bigint;
    vReserves0: bigint;
    vReserves1: bigint;
  };
  trendData: {
    shortEMA: bigint;
    longEMA: bigint;
    lastBlockVolume: bigint;
    lastTradeBlock: bigint;
  };
  ampBps: bigint;
}

export interface KyberDmmPoolOrderedParams {
  tokenIn: string;
  tokenOut: string;
  poolData: Array<{
    poolAddress: string;
    state: KyberDmmPoolState;
  }>;
  direction: boolean;
  exchanges: string[];
}

const iface = new Interface(kyberDmmPoolABI);
const coder = new AbiCoder();

export class KyberDmmPool extends StatefulEventSubscriber<KyberDmmPoolState> {
  decoder: (log: Log) => KyberDmmAbiEvents = (log: Log) =>
    iface.parseLog(log) as any as KyberDmmAbiEvents;

  constructor(
    protected parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,

    token0: Token,
    token1: Token,
    public ampBps: bigint,

    logger: Logger,
  ) {
    super(
      parentName +
        ' ' +
        (token0.symbol || token0.address) +
        '-' +
        (token1.symbol || token1.address) +
        ' pool',
      logger,
    );
  }

  protected async processLog(
    state: DeepReadonly<KyberDmmPoolState>,
    log: Readonly<Log>,
    blockHeader: BlockHeader,
  ): Promise<DeepReadonly<KyberDmmPoolState> | null> {
    const event = this.decoder(log);
    switch (event.name) {
      case 'Sync': {
        if (this.isAmpPool())
          return {
            ...state,
            reserves: {
              reserves0: BigInt(event.args.reserve0.toString()),
              reserves1: BigInt(event.args.reserve1.toString()),
              vReserves0: BigInt(event.args.vReserve0.toString()),
              vReserves1: BigInt(event.args.vReserve1.toString()),
            },
          };
        else
          return {
            ...state,
            reserves: {
              reserves0: BigInt(event.args.reserve0.toString()),
              reserves1: BigInt(event.args.reserve1.toString()),
              vReserves0: BigInt(event.args.reserve0.toString()),
              vReserves1: BigInt(event.args.reserve1.toString()),
            },
          };
      }
      case 'UpdateEMA':
        return {
          ...state,
          trendData: {
            shortEMA: BigInt(event.args.shortEMA.toString()),
            longEMA: BigInt(event.args.longEMA.toString()),
            lastBlockVolume: BigInt(event.args.lastBlockVolume.toString()),
            lastTradeBlock: BigInt(blockHeader.number.toString()),
          },
        };
    }
    return null;
  }

  isAmpPool(): boolean {
    return this.ampBps != BPS;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<KyberDmmPoolState>> {
    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate([
          {
            target: this.poolAddress,
            callData: iface.encodeFunctionData('getTradeInfo', []),
          },
          {
            target: this.poolAddress,
            callData: iface.encodeFunctionData('getVolumeTrendData', []),
          },
        ])
        .call({}, blockNumber);

    const [reserves0, reserves1, vReserves0, vReserves1] = coder
      .decode(['uint256', 'uint256', 'uint256', 'uint256'], data.returnData[0])
      .map(a => BigInt(a.toString()));

    const [shortEMA, longEMA, , lastTradeBlock] = coder
      .decode(['uint256', 'uint256', 'uint128', 'uint256'], data.returnData[1])
      .map(a => BigInt(a.toString()));

    if (blockNumber == 'latest')
      blockNumber = await this.dexHelper.web3Provider.eth.getBlockNumber();

    const prevBlockData: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate([
          {
            target: this.poolAddress,
            callData: iface.encodeFunctionData('getVolumeTrendData', []),
          },
        ])
        .call({}, blockNumber - 1);

    const [, , lastBlockVolume] = coder
      .decode(
        ['uint256', 'uint256', 'uint128', 'uint256'],
        prevBlockData.returnData[0],
      )
      .map(a => BigInt(a.toString()));

    return {
      trendData: {
        shortEMA,
        longEMA,
        lastBlockVolume,
        lastTradeBlock,
      },
      reserves: {
        reserves0,
        reserves1,
        vReserves0,
        vReserves1,
      },
      ampBps: this.ampBps,
    };
  }
}

const BPS = 10000n;

const getFinalFee = (feeInPrecision: bigint, _ampBps: bigint): bigint => {
  if (_ampBps <= 20000) {
    return feeInPrecision;
  } else if (_ampBps <= 50000) {
    return (feeInPrecision * 20n) / 30n;
  } else if (_ampBps <= 200000) {
    return (feeInPrecision * 10n) / 30n;
  } else {
    return (feeInPrecision * 4n) / 30n;
  }
};

/// @dev returns data to calculate amountIn, amountOut
export const getTradeInfo = (
  state: KyberDmmPoolState,
  blockNumber: number,
  isTokenOrdered: boolean,
): TradeInfo => {
  const _ampBps = state.ampBps;
  let vReserves0 = state.reserves.vReserves0;
  let vReserves1 = state.reserves.vReserves1;
  if (_ampBps == BPS) {
    vReserves0 = state.reserves.reserves0;
    vReserves1 = state.reserves.reserves1;
  }
  const rFactorInPrecision = getRFactor(BigInt(blockNumber), state.trendData);
  const feeInPrecision = getFinalFee(getFee(rFactorInPrecision), _ampBps);
  return {
    reserves0: isTokenOrdered
      ? state.reserves.reserves0
      : state.reserves.reserves1,
    reserves1: isTokenOrdered
      ? state.reserves.reserves1
      : state.reserves.reserves0,
    vReserves0: isTokenOrdered ? vReserves0 : vReserves1,
    vReserves1: isTokenOrdered ? vReserves1 : vReserves0,
    feeInPrecision,
  };
};
