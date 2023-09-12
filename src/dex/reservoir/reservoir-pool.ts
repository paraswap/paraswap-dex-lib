import { AbiCoder, Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, Token } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ReservoirPoolState, ReservoirPoolTypes } from './types';
import ReservoirPairABI from '../../abi/reservoir/ReservoirPair.json';
import StablePairABI from '../../abi/reservoir/StablePair.json';
import { Address } from '@paraswap/core';

const LogCallTopics = [
  // sync(uint104, uint104)
  '0xcf2aa50876cdfbb541206f89af0ee78d44a2abf8d328e37fa4917f982149848a',
];

export class ReservoirEventPool extends StatefulEventSubscriber<ReservoirPoolState> {
  decoder = (log: Log) => this.reservoirIface.parseLog(log);
  coder = new AbiCoder();

  constructor(
    readonly parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    private token0: Token,
    private token1: Token,
    private curveId: ReservoirPoolTypes,
    logger: Logger,
    protected reservoirIface = new Interface(ReservoirPairABI),
    protected stablePairIface = new Interface(StablePairABI),
  ) {
    const poolName = token0.address + '-' + token1.address + '-' + curveId;
    super(parentName, poolName, dexHelper, logger);
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<ReservoirPoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<ReservoirPoolState> | null {
    this.logger.error('processLog', log);
    if (LogCallTopics.includes(log.topics[0])) return null;

    const event = this.decoder(log);
    switch (event.name) {
      case 'Sync':
        return {
          reserve0: event.args.reserve0.toString(),
          reserve1: event.args.reserve1.toString(),
          curveId: state.curveId,
          swapFee: state.swapFee,
          ampCoefficient: state.ampCoefficient,
        };
      // TODO: also handle SwapFee(fees change) and (RampA) ampCoefficient changes
    }

    return null;
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<ReservoirPoolState>> {
    let calldata = [
      {
        target: this.poolAddress,
        callData: this.reservoirIface.encodeFunctionData('getReserves', []),
      },
    ];

    // get swap fee
    calldata.push({
      target: this.poolAddress,
      callData: this.reservoirIface.encodeFunctionData('swapFee', []),
    });

    // get amp coefficient(if applicable)
    if (this.curveId == ReservoirPoolTypes.Stable) {
      calldata.push({
        target: this.poolAddress,
        callData: this.stablePairIface.encodeFunctionData('ampData', []),
      });
    }

    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber);

    const reserves = this.coder.decode(
      ['uint104', 'uint104', 'uint32', 'uint16'],
      data.returnData[0],
    );
    const swapFee = this.coder.decode(['uint256'], data.returnData[1]);
    // TODO: to actually calculate the effective A at the moment
    // given the current timestamp (how do we get this?)
    const ampCoefficient = this.coder.decode(
      ['uint64', 'uint64', 'uint64', 'uint64'],
      data.returnData[2],
    );

    return {
      reserve0: reserves[0].toString(),
      reserve1: reserves[1].toString(),
      curveId: this.curveId,
      swapFee: BigInt(swapFee.toString()),
      ampCoefficient: BigInt(ampCoefficient[1]),
    };
  }
}
