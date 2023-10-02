import { DeepReadonly } from 'ts-essentials';
import { PartialEventSubscriber } from '../../composed-event-subscriber';
import {
  Address,
  BlockHeader,
  Log,
  Logger,
  MultiCallInput,
  MultiCallOutput,
} from '../../types';
import { Lens } from '../../lens';
import { Interface } from '@ethersproject/abi';
import LPABI from '../../abi/mantis-swap/lp.json';
import { MantisLPState } from './types';

export class MantisLPSubscriber<State> extends PartialEventSubscriber<
  State,
  MantisLPState
> {
  static readonly lpInterface = new Interface(LPABI);

  constructor(
    private lp: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<MantisLPState>>,
    logger: Logger,
  ) {
    super([lp], lens, logger);
  }

  public processLog(
    state: DeepReadonly<MantisLPState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<MantisLPState> | null {
    try {
      const parsed = MantisLPSubscriber.lpInterface.parseLog(log);
      switch (parsed.name) {
        case 'AssetUpdated': {
          const oldAmount = BigInt(parsed.args.oldAmount.toString());
          const newAmount = BigInt(parsed.args.newAmount.toString());
          if (state.asset !== oldAmount) {
            this.logger.error('state.asset !== oldAmount');
          }
          return {
            asset: newAmount,
            liability: state.liability,
            decimals: state.decimals,
          };
        }
        case 'LiabilityUpdated': {
          const oldAmount = BigInt(parsed.args.oldAmount.toString());
          const newAmount = BigInt(parsed.args.newAmount.toString());
          if (state.liability !== oldAmount) {
            this.logger.error('state.liability !== oldAmount');
          }
          return {
            asset: state.asset,
            liability: newAmount,
            decimals: state.decimals,
          };
        }
        default:
          return null;
      }
    } catch (e) {
      this.logger.error('Failed to parse log', e);
      return null;
    }
  }

  public getGenerateStateMultiCallInputs(): MultiCallInput[] {
    return [
      {
        target: this.lp,
        callData: MantisLPSubscriber.lpInterface.encodeFunctionData('asset'),
      },
      {
        target: this.lp,
        callData:
          MantisLPSubscriber.lpInterface.encodeFunctionData('liability'),
      },
      {
        target: this.lp,
        callData: MantisLPSubscriber.lpInterface.encodeFunctionData('decimals'),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<MantisLPState> {
    return {
      asset: BigInt(
        MantisLPSubscriber.lpInterface
          .decodeFunctionResult('asset', multicallOutputs[0])[0]
          .toString(),
      ),
      liability: BigInt(
        MantisLPSubscriber.lpInterface
          .decodeFunctionResult('liability', multicallOutputs[1])[0]
          .toString(),
      ),
      decimals: Number(
        MantisLPSubscriber.lpInterface
          .decodeFunctionResult('decimals', multicallOutputs[2])[0]
          .toString(),
      ),
    };
  }
}
