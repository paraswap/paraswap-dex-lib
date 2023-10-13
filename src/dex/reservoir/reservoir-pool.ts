import { AbiCoder, Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, Token } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ReservoirPoolState, ReservoirPoolTypes } from './types';
import { Address } from '@paraswap/core';
import { reservoirPairIface, stablePairIface } from './constants';

const LogCallTopics = [
  // sync(uint104, uint104)
  '0xff388a12130349259b5ae24af90448f511c2340be808f2c371230fc2da175c44',
];

export class ReservoirEventPool extends StatefulEventSubscriber<ReservoirPoolState> {
  decoder = (log: Log) => reservoirPairIface.parseLog(log);
  coder = new AbiCoder();

  constructor(
    readonly parentName: string,
    protected dexHelper: IDexHelper,
    private poolAddress: Address,
    private token0: Token,
    private token1: Token,
    private curveId: ReservoirPoolTypes,
    logger: Logger,
  ) {
    const poolName = token0.address + '-' + token1.address + '-' + curveId;
    super(parentName, poolName, dexHelper, logger);
  }

  protected processLog(
    state: DeepReadonly<ReservoirPoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<ReservoirPoolState> | null {
    this.logger.debug('processLog', log);
    if (!LogCallTopics.includes(log.topics[0])) return null;

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

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<ReservoirPoolState>> {
    let calldata = [
      {
        target: this.poolAddress,
        callData: reservoirPairIface.encodeFunctionData('getReserves', []),
      },
    ];

    // get swap fee
    calldata.push({
      target: this.poolAddress,
      callData: reservoirPairIface.encodeFunctionData('swapFee', []),
    });

    // get amp coefficient(if applicable)
    if (this.curveId == ReservoirPoolTypes.Stable) {
      calldata.push({
        target: this.poolAddress,
        callData: stablePairIface.encodeFunctionData('ampData', []),
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
