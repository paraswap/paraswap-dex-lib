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
import PoolABI from '../../abi/mantis-swap/pool.json';
import { MantisPoolParams } from './types';

type MantisToken = {
  [tokenAddress: string]: {
    tokenSymbol: string;
    tokenDecimals: number;
    lpAddress: Address;
    chainlink: {
      proxyAddress: Address;
      aggregatorAddress: Address;
    };
  };
};

export class MantisPoolSubscriber<State> extends PartialEventSubscriber<
  State,
  MantisPoolParams
> {
  static readonly poolInterface = new Interface(PoolABI);
  protected tokens: MantisToken;

  constructor(
    private pool: Address,
    tokens: MantisToken,
    lens: Lens<DeepReadonly<State>, DeepReadonly<MantisPoolParams>>,
    logger: Logger,
  ) {
    super([pool], lens, logger);
    this.tokens = tokens;
  }

  public processLog(
    state: DeepReadonly<MantisPoolParams>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<MantisPoolParams> | null {
    try {
      const parsed = MantisPoolSubscriber.poolInterface.parseLog(log);
      switch (parsed.name) {
        case 'Paused': {
          return {
            ...state,
            paused: true,
          };
        }
        case 'Unpaused': {
          return {
            ...state,
            paused: false,
          };
        }
        case 'SlippageParamsUpdated': {
          const newA = BigInt(parsed.args.slippageA.toString());
          const newN = BigInt(parsed.args.slippageN.toString());
          return {
            ...state,
            slippageA: newA,
            slippageN: newN,
          };
        }
        case 'BaseFeeUpdated': {
          const newBaseFee = BigInt(parsed.args.baseFee.toString());
          return {
            ...state,
            baseFee: newBaseFee,
          };
        }
        case 'LPRatioUpdated': {
          const newLPRatio = BigInt(parsed.args.lpRatio.toString());
          return {
            ...state,
            lpRatio: newLPRatio,
          };
        }
        case 'RiskUpdated': {
          const token = parsed.args.token.toString().toLowerCase();
          const newRisk = BigInt(parsed.args.risk.toString());
          return {
            ...state,
            riskProfile: { ...state.riskProfile, [token]: newRisk },
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
    let inputs: MultiCallInput[] = [];
    inputs = [
      {
        target: this.pool,
        callData:
          MantisPoolSubscriber.poolInterface.encodeFunctionData('paused'),
      },
      {
        target: this.pool,
        callData:
          MantisPoolSubscriber.poolInterface.encodeFunctionData('slippageA'),
      },
      {
        target: this.pool,
        callData:
          MantisPoolSubscriber.poolInterface.encodeFunctionData('slippageN'),
      },
      {
        target: this.pool,
        callData:
          MantisPoolSubscriber.poolInterface.encodeFunctionData('slippageK'),
      },
      {
        target: this.pool,
        callData:
          MantisPoolSubscriber.poolInterface.encodeFunctionData('baseFee'),
      },
      {
        target: this.pool,
        callData:
          MantisPoolSubscriber.poolInterface.encodeFunctionData('lpRatio'),
      },
    ];
    for (const [key, value] of Object.entries(this.tokens)) {
      inputs.push({
        target: this.pool,
        callData: MantisPoolSubscriber.poolInterface.encodeFunctionData(
          'riskProfile',
          [value.lpAddress],
        ),
      });
    }
    return inputs;
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<MantisPoolParams> {
    const paused = MantisPoolSubscriber.poolInterface.decodeFunctionResult(
      'paused',
      multicallOutputs[0],
    )[0];
    const slippageA = BigInt(
      MantisPoolSubscriber.poolInterface
        .decodeFunctionResult('slippageA', multicallOutputs[1])[0]
        .toString(),
    );
    const slippageN = BigInt(
      MantisPoolSubscriber.poolInterface
        .decodeFunctionResult('slippageN', multicallOutputs[2])[0]
        .toString(),
    );
    const slippageK = BigInt(
      MantisPoolSubscriber.poolInterface
        .decodeFunctionResult('slippageK', multicallOutputs[3])[0]
        .toString(),
    );
    const baseFee = BigInt(
      MantisPoolSubscriber.poolInterface
        .decodeFunctionResult('baseFee', multicallOutputs[4])[0]
        .toString(),
    );
    const lpRatio = BigInt(
      MantisPoolSubscriber.poolInterface
        .decodeFunctionResult('lpRatio', multicallOutputs[5])[0]
        .toString(),
    );
    let riskProfile: Record<Address, bigint> = {};
    let i = 6;
    for (const [key, value] of Object.entries(this.tokens)) {
      riskProfile[key] = BigInt(
        MantisPoolSubscriber.poolInterface
          .decodeFunctionResult('riskProfile', multicallOutputs[i++])[0]
          .toString(),
      );
    }
    return {
      paused,
      slippageA,
      slippageN,
      slippageK,
      baseFee,
      lpRatio,
      riskProfile,
    };
  }
}
