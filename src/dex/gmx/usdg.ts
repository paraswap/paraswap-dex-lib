import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { PartialEventSubscriber } from '../../composed-event-subscriber';
import {
  Address,
  MultiCallInput,
  MultiCallOutput,
  Logger,
  Log,
  BlockHeader,
} from '../../types';
import { USDGState } from './types';
import ERC20ABI from '../../abi/erc20.json';
import { Lens } from '../../lens';
import { NULL_ADDRESS } from '../../constants';

export class USDG<State> extends PartialEventSubscriber<State, USDGState> {
  static readonly interface = new Interface(ERC20ABI);

  constructor(
    private usdgAddress: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<USDGState>>,
    logger: Logger,
  ) {
    super([usdgAddress], lens, logger);
  }

  getTotalSupply(state: DeepReadonly<State>) {
    return this.lens.get()(state).totalSupply;
  }

  public processLog(
    state: DeepReadonly<USDGState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<USDGState> | null {
    try {
      const parsed = USDG.interface.parseLog(log);
      const _state: USDGState = state;
      switch (parsed.name) {
        case 'Transfer': {
          const fromAddress = parsed.args.from;
          const toAddress = parsed.args.to;
          if (fromAddress === NULL_ADDRESS) {
            _state.totalSupply += BigInt(parsed.args.value.toString());
          } else if (toAddress === NULL_ADDRESS) {
            _state.totalSupply -= BigInt(parsed.args.value.toString());
          }
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
        target: this.usdgAddress,
        callData: USDG.interface.encodeFunctionData('totalSupply'),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<USDGState> {
    return {
      totalSupply: BigInt(
        USDG.interface.decodeFunctionResult(
          'totalSupply',
          multicallOutputs[0],
        )[0],
      ),
    };
  }
}
