import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { SmardexFees, SmardexPoolState } from './types';
import { AbiCoder, Interface } from '@ethersproject/abi';
import { IDexHelper } from '../../dex-helper';
import { Address, Log, Logger, Token } from '../../types';
import { DeepReadonly } from 'ts-essentials';
import { FEES_LAYER_ONE, TOPICS } from './constants';

const coder = new AbiCoder();

export class SmardexEventPool extends StatefulEventSubscriber<SmardexPoolState> {
  constructor(
    protected poolInterface: Interface,
    protected dexHelper: IDexHelper,
    public poolAddress: Address,
    token0: Token,
    token1: Token,
    logger: Logger,
    protected smardexFeesMultiCallEntry?: {
      target: string;
      callData: string;
    },
    protected smardexFeesMulticallDecoder?: (values: any[]) => SmardexFees,
    private isLayerOne = true,
  ) {
    super(
      'Smardex',
      (token0.symbol || token0.address) +
      '-' +
      (token1.symbol || token1.address) +
      ' pool',
      dexHelper,
      logger,
    );
  }

  async fetchPairFeesAndLastTimestamp(blockNumber: number): Promise<{
    feesLP: bigint;
    feesPool: bigint;
    priceAverageLastTimestamp: number;
  }> {
    let calldata = [
      {
        target: this.poolAddress,
        callData: this.poolInterface.encodeFunctionData('getPriceAverage', []),
      },
    ];
    if (!this.isLayerOne) {
      calldata.push(this.smardexFeesMultiCallEntry!);
    }

    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber);

    const priceAverageLastTimestamp = coder.decode(
      ['uint256', 'uint256', 'uint256'],
      data.returnData[0],
    )[2];

    const fees = this.isLayerOne
      ? FEES_LAYER_ONE
      : this.smardexFeesMulticallDecoder!(data.returnData[1]);
    return {
      feesLP: fees.feesLP,
      feesPool: fees.feesPool,
      priceAverageLastTimestamp: priceAverageLastTimestamp.toNumber(),
    };
  }

  // This methode overrides previous state with new state.
  // Problem: Smardex Pair state is updated partially on different events
  // This is why we must fetch pair's missing state in Events
  protected async processLog(
    state: DeepReadonly<SmardexPoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<SmardexPoolState> | null> {
    if (!Object.values(TOPICS).includes(log.topics[0] as TOPICS)) return null;
    const event = this.poolInterface.parseLog(log);
    switch (event.name) {
      case 'Sync':
        const fetchedSync = await this.fetchPairFeesAndLastTimestamp(
          log.blockNumber,
        );
        return {
          reserves0: event.args.reserve0.toString(),
          reserves1: event.args.reserve1.toString(),
          fictiveReserves0: event.args.fictiveReserve0.toString(),
          fictiveReserves1: event.args.fictiveReserve1.toString(),
          priceAverage0: event.args.priceAverage0.toString(),
          priceAverage1: event.args.priceAverage1.toString(),
          priceAverageLastTimestamp: fetchedSync.priceAverageLastTimestamp,
          feesLP: fetchedSync.feesLP,
          feesPool: fetchedSync.feesPool,
        };
      case 'FeesChanged': // only triggerd on L2
        return {
          reserves0: state.reserves0,
          reserves1: state.reserves1,
          fictiveReserves0: state.fictiveReserves0,
          fictiveReserves1: state.fictiveReserves1,
          priceAverage0: state.priceAverage0,
          priceAverage1: state.priceAverage1,
          priceAverageLastTimestamp: state.priceAverageLastTimestamp,
          feesLP: BigInt(event.args.feesLP),
          feesPool: BigInt(event.args.feesPool),
        };
      // case 'Swap':
      //   const fetchedSwap = await this.fetchPairFeesAndLastTimestamp(log.blockNumber);
      //   return {
      //     reserves0: state.reserves0,
      //     reserves1: state.reserves1,
      //     fictiveReserves0: state.fictiveReserves0,
      //     fictiveReserves1: state.fictiveReserves1,
      //     priceAverage0: state.priceAverage0,
      //     priceAverage1: state.priceAverage1,
      //     priceAverageLastTimestamp: fetchedSwap.priceAverageLastTimestamp,
      //     feesLP: fetchedSwap.feesLP,
      //     feesPool: fetchedSwap.feesPool,
      //   };
    }
    return null;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<SmardexPoolState>> {
    const coder = new AbiCoder();
    let calldata = [
      {
        target: this.poolAddress,
        callData: this.poolInterface.encodeFunctionData('getReserves', []),
      },
      {
        target: this.poolAddress,
        callData: this.poolInterface.encodeFunctionData(
          'getFictiveReserves',
          [],
        ),
      },
      {
        target: this.poolAddress,
        callData: this.poolInterface.encodeFunctionData('getPriceAverage', []),
      },
    ];
    if (!this.isLayerOne) {
      calldata.push(this.smardexFeesMultiCallEntry!);
    }

    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber);

    const [reserves0, reserves1] = coder.decode(
      ['uint256', 'uint256'],
      data.returnData[0],
    );

    const [fictiveReserve0, fictiveReserve1] = coder.decode(
      ['uint256', 'uint256'],
      data.returnData[1],
    );

    const [priceAverage0, priceAverage1, priceAverageLastTimestamp] =
      coder.decode(['uint256', 'uint256', 'uint256'], data.returnData[2]);

    const fees = this.isLayerOne
      ? FEES_LAYER_ONE
      : this.smardexFeesMulticallDecoder!(data.returnData[3]);

    return {
      reserves0: reserves0.toString(),
      reserves1: reserves1.toString(),
      fictiveReserves0: fictiveReserve0.toString(),
      fictiveReserves1: fictiveReserve1.toString(),
      priceAverage0: priceAverage0.toString(),
      priceAverage1: priceAverage1.toString(),
      priceAverageLastTimestamp: priceAverageLastTimestamp.toNumber(),
      feesLP: fees.feesLP,
      feesPool: fees.feesPool,
    };
  }
}
