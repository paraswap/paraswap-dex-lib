import _ from 'lodash';
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
import { USDMState } from './types';
import ERC20ABI from '../../abi/erc20.json';
import { Lens } from '../../lens';
import { NULL_ADDRESS } from '../../constants';

export class USDM<State> extends PartialEventSubscriber<State, USDMState> {
  static readonly interface = new Interface(ERC20ABI);

  constructor(
    private usdgAddress: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<USDMState>>,
    logger: Logger,
  ) {
    super([usdgAddress], lens, logger);
  }

  getTotalSupply(state: DeepReadonly<State>) {
    return this.lens.get()(state).totalSupply;
  }

  public processLog(
    state: DeepReadonly<USDMState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<USDMState> | null {
    try {
      const parsed = USDM.interface.parseLog(log);
      const _state: USDMState = _.cloneDeep(state);
      switch (parsed.name) {
        case 'Transfer': {
          const fromAddress = parsed.args.src;
          const toAddress = parsed.args.dst;
          if (fromAddress === NULL_ADDRESS) {
            _state.totalSupply += BigInt(parsed.args.wad.toString());
          } else if (toAddress === NULL_ADDRESS) {
            _state.totalSupply -= BigInt(parsed.args.wad.toString());
          }
          return _state;
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
        callData: USDM.interface.encodeFunctionData('totalSupply'),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<USDMState> {
    return {
      totalSupply: BigInt(
        USDM.interface.decodeFunctionResult(
          'totalSupply',
          multicallOutputs[0],
        )[0],
      ),
    };
  }
}
