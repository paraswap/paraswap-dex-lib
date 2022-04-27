import { DeepReadonly } from 'ts-essentials';
import {
  ComposedEventSubscriber,
  PartialEventSubscriber,
} from '../../composed-event-subscriber';
import {
  Address,
  BlockHeader,
  Log,
  Logger,
  MultiCallInput,
  MultiCallOutput,
} from '../../types';
import { Lens, lens } from '../../lens';
import { Interface } from '@ethersproject/abi';
import PoolABI from '../../abi/platypus/pool.json';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { PlatypusAssetSubscriber } from './asset';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PlatypusPoolState,
  PlatypusPoolParams,
  PlatypusPoolConfigInfo,
} from './types';

export class PlatypusPool extends ComposedEventSubscriber<PlatypusPoolState> {
  constructor(
    dexKey: string,
    network: number,
    name: string,
    poolAddress: Address,
    poolCfg: PlatypusPoolConfigInfo,
    dexHelper: IDexHelper,
  ) {
    super(
      `${dexKey} ${name}`,
      dexHelper.getLogger(`${dexKey}-${network} ${name}`),
      dexHelper,
      [
        new PlatypusPoolSubscriber<PlatypusPoolState>(
          poolAddress,
          lens<DeepReadonly<PlatypusPoolState>>().params,
          dexHelper.getLogger(`${dexKey}-${network} Params ${name}`),
        ),
        ...Object.entries(poolCfg.tokens)
          .map(([tokenAddress, c]) => [
            new PlatypusAssetSubscriber<PlatypusPoolState>(
              c.assetAddress,
              lens<DeepReadonly<PlatypusPoolState>>().asset[tokenAddress],
              dexHelper.getLogger(
                `${dexKey}-${network} ${c.tokenSymbol} asset ${name}`,
              ),
            ),
            new ChainLinkSubscriber<PlatypusPoolState>(
              c.chainlink.proxyAddress,
              c.chainlink.aggregatorAddress,
              lens<DeepReadonly<PlatypusPoolState>>().chainlink[tokenAddress],
              dexHelper.getLogger(
                `${c.tokenSymbol} ChainLink for ${dexKey}-${network} ${name}`,
              ),
            ),
          ])
          .flat(),
      ],
      {
        params: {
          slippageParamK: 0n,
          slippageParamN: 0n,
          c1: 0n,
          xThreshold: 0n,
          haircutRate: 0n,
          retentionRatio: 0n,
          maxPriceDeviation: 0n,
        },
        chainlink: {},
        asset: {},
      },
    );
  }
}

export class PlatypusPoolSubscriber<State> extends PartialEventSubscriber<
  State,
  PlatypusPoolParams
> {
  static readonly poolInterface = new Interface(PoolABI);

  constructor(
    private pool: Address,
    lens: Lens<DeepReadonly<State>, DeepReadonly<PlatypusPoolParams>>,
    logger: Logger,
  ) {
    super([pool], lens, logger);
  }

  public processLog(
    state: DeepReadonly<PlatypusPoolParams>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): DeepReadonly<PlatypusPoolParams> | null {
    try {
      const parsed = PlatypusPoolSubscriber.poolInterface.parseLog(log);
      switch (parsed.name) {
        case 'PriceDeviationUpdated': {
          const previousPriceDeviation = BigInt(
            parsed.args.previousPriceDeviation.toString(),
          );
          const newPriceDeviation = BigInt(
            parsed.args.newPriceDeviation.toString(),
          );
          if (state.maxPriceDeviation !== previousPriceDeviation) {
            this.logger.error(
              'state.maxPriceDeviation !== previousPriceDeviation',
            );
          }
          return {
            ...state,
            maxPriceDeviation: newPriceDeviation,
          };
        }
        case 'SlippageParamsUpdated': {
          const previousK = BigInt(parsed.args.previousK.toString());
          const newK = BigInt(parsed.args.newK.toString());
          const previousN = BigInt(parsed.args.previousN.toString());
          const newN = BigInt(parsed.args.newN.toString());
          const previousC1 = BigInt(parsed.args.previousC1.toString());
          const newC1 = BigInt(parsed.args.newC1.toString());
          const previousXThreshold = BigInt(
            parsed.args.previousXThreshold.toString(),
          );
          const newXThreshold = BigInt(parsed.args.newXThreshold.toString());
          if (state.slippageParamK !== previousK) {
            this.logger.error('state.slippageParamK !== previousK');
          }
          if (state.slippageParamN !== previousN) {
            this.logger.error('state.slippageParamN !== previousN');
          }
          if (state.c1 !== previousC1) {
            this.logger.error('state.c1 !== previousC1');
          }
          if (state.xThreshold !== previousXThreshold) {
            this.logger.error('state.xThreshold !== previousXThreshold');
          }
          return {
            ...state,
            slippageParamK: newK,
            slippageParamN: newN,
            c1: newC1,
            xThreshold: newXThreshold,
          };
        }
        case 'HaircutRateUpdated': {
          const previousHaircut = BigInt(
            parsed.args.previousHaircut.toString(),
          );
          const newHaircut = BigInt(parsed.args.newHaircut.toString());
          if (state.haircutRate !== previousHaircut) {
            this.logger.error('state.haircutRate !== previousHaircut');
          }
          return {
            ...state,
            haircutRate: newHaircut,
          };
        }
        case 'RetentionRatioUpdated': {
          const previousRetentionRatio = BigInt(
            parsed.args.previousRetentionRatio.toString(),
          );
          const newRetentionRatio = BigInt(
            parsed.args.newRetentionRatio.toString(),
          );
          if (state.retentionRatio !== previousRetentionRatio) {
            this.logger.error(
              'state.retentionRatio !== previousRetentionRatio',
            );
          }
          return {
            ...state,
            retentionRatio: newRetentionRatio,
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
        target: this.pool,
        callData:
          PlatypusPoolSubscriber.poolInterface.encodeFunctionData(
            'getSlippageParamK',
          ),
      },
      {
        target: this.pool,
        callData:
          PlatypusPoolSubscriber.poolInterface.encodeFunctionData(
            'getSlippageParamN',
          ),
      },
      {
        target: this.pool,
        callData:
          PlatypusPoolSubscriber.poolInterface.encodeFunctionData('getC1'),
      },
      {
        target: this.pool,
        callData:
          PlatypusPoolSubscriber.poolInterface.encodeFunctionData(
            'getXThreshold',
          ),
      },
      {
        target: this.pool,
        callData:
          PlatypusPoolSubscriber.poolInterface.encodeFunctionData(
            'getHaircutRate',
          ),
      },
      {
        target: this.pool,
        callData:
          PlatypusPoolSubscriber.poolInterface.encodeFunctionData(
            'getRetentionRatio',
          ),
      },
      {
        target: this.pool,
        callData: PlatypusPoolSubscriber.poolInterface.encodeFunctionData(
          'getMaxPriceDeviation',
        ),
      },
    ];
  }

  public generateState(
    multicallOutputs: MultiCallOutput[],
    blockNumber?: number | 'latest',
  ): DeepReadonly<PlatypusPoolParams> {
    return {
      slippageParamK: BigInt(
        PlatypusPoolSubscriber.poolInterface
          .decodeFunctionResult('getSlippageParamK', multicallOutputs[0])[0]
          .toString(),
      ),
      slippageParamN: BigInt(
        PlatypusPoolSubscriber.poolInterface
          .decodeFunctionResult('getSlippageParamN', multicallOutputs[1])[0]
          .toString(),
      ),
      c1: BigInt(
        PlatypusPoolSubscriber.poolInterface
          .decodeFunctionResult('getC1', multicallOutputs[2])[0]
          .toString(),
      ),
      xThreshold: BigInt(
        PlatypusPoolSubscriber.poolInterface
          .decodeFunctionResult('getXThreshold', multicallOutputs[3])[0]
          .toString(),
      ),
      haircutRate: BigInt(
        PlatypusPoolSubscriber.poolInterface
          .decodeFunctionResult('getHaircutRate', multicallOutputs[4])[0]
          .toString(),
      ),
      retentionRatio: BigInt(
        PlatypusPoolSubscriber.poolInterface
          .decodeFunctionResult('getRetentionRatio', multicallOutputs[5])[0]
          .toString(),
      ),
      maxPriceDeviation: BigInt(
        PlatypusPoolSubscriber.poolInterface
          .decodeFunctionResult('getMaxPriceDeviation', multicallOutputs[6])[0]
          .toString(),
      ),
    };
  }
}
