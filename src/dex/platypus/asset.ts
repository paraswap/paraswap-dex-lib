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
import AssetABI from '../../abi/platypus/asset.json';
import { PlatypusAssetState } from './types';

export class PlatypusAssetSubscriber<State> extends PartialEventSubscriber<
  State,
  PlatypusAssetState
> {
  static readonly assetInterface = new Interface(AssetABI);

  constructor(
    private asset: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<PlatypusAssetState>>,
    logger: Logger,
  ) {
    super([asset], lens, logger);
  }

  public processLog(
    state: DeepReadonly<PlatypusAssetState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PlatypusAssetState> | null {
    try {
      const parsed = PlatypusAssetSubscriber.assetInterface.parseLog(log);
      switch (parsed.name) {
        case 'CashAdded': {
          const previousCashPosition = BigInt(
            parsed.args.previousCashPosition.toString(),
          );
          const cashBeingAdded = BigInt(parsed.args.cashBeingAdded.toString());
          if (state.cash !== previousCashPosition) {
            this.logger.error('state.cash !== previousCashPosition');
          }
          return {
            cash: previousCashPosition + cashBeingAdded,
            liability: state.liability,
          };
        }
        case 'CashRemoved': {
          const previousCashPosition = BigInt(
            parsed.args.previousCashPosition.toString(),
          );
          const cashBeingRemoved = BigInt(
            parsed.args.cashBeingRemoved.toString(),
          );
          if (state.cash !== previousCashPosition) {
            this.logger.error('state.cash !== previousCashPosition');
          }
          return {
            cash: previousCashPosition - cashBeingRemoved,
            liability: state.liability,
          };
        }
        case 'LiabilityAdded': {
          const previousLiabilityPosition = BigInt(
            parsed.args.previousLiabilityPosition.toString(),
          );
          const liabilityBeingAdded = BigInt(
            parsed.args.liabilityBeingAdded.toString(),
          );
          if (state.liability !== previousLiabilityPosition) {
            this.logger.error('state.liability !== previousLiabilityPosition');
          }
          return {
            cash: state.cash,
            liability: previousLiabilityPosition + liabilityBeingAdded,
          };
        }
        case 'LiabilityRemoved': {
          const previousLiabilityPosition = BigInt(
            parsed.args.previousLiabilityPosition.toString(),
          );
          const liabilityBeingRemoved = BigInt(
            parsed.args.liabilityBeingRemoved.toString(),
          );
          if (state.liability !== previousLiabilityPosition) {
            this.logger.error('state.liability !== previousLiabilityPosition');
          }
          return {
            cash: state.cash,
            liability: previousLiabilityPosition - liabilityBeingRemoved,
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
        target: this.asset,
        callData:
          PlatypusAssetSubscriber.assetInterface.encodeFunctionData('cash'),
      },
      {
        target: this.asset,
        callData:
          PlatypusAssetSubscriber.assetInterface.encodeFunctionData(
            'liability',
          ),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<PlatypusAssetState> {
    return {
      cash: BigInt(
        PlatypusAssetSubscriber.assetInterface
          .decodeFunctionResult('cash', multicallOutputs[0])[0]
          .toString(),
      ),
      liability: BigInt(
        PlatypusAssetSubscriber.assetInterface
          .decodeFunctionResult('liability', multicallOutputs[1])[0]
          .toString(),
      ),
    };
  }
}
