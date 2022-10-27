import { DeepReadonly } from 'ts-essentials';
import { BlockHeader } from '../../types';
import { Address } from '../../types';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  SwaapV1PoolState,
  SubgraphPoolBase,
  SwaapV1PoolParameters,
  SwaapV1PoolLiquidities,
  SwaapV1PoolOracles,
  OracleInitialData,
  ChainLinkData,
} from './types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Log, MultiCallInput, MultiCallOutput } from '../../types';
import PoolABI from '../../abi/swaap-v1/pool.json';
import ProxyABI from '../../abi/chainlink.json';
import Erc20ABI from '../../abi/erc20.json';
import { Interface } from '@ethersproject/abi';

export class SwaapV1Pool extends StatefulEventSubscriber<SwaapV1PoolState> {
  static readonly poolInterface = new Interface(PoolABI);
  static readonly proxyInterface = new Interface(ProxyABI);
  static readonly erc20Interface = new Interface(Erc20ABI);
  // LOG_CALL Event topics 0
  static readonly SWAP_FEE_TOPIC =
    '0x34e1990700000000000000000000000000000000000000000000000000000000';
  static readonly LB_IN_ROUND_TOPIC =
    '0x3cc3396000000000000000000000000000000000000000000000000000000000';
  static readonly LB_STEP_IN_ROUND_TOPIC =
    '0x045dbae000000000000000000000000000000000000000000000000000000000';
  static readonly Z_TOPIC =
    '0x3c515d9900000000000000000000000000000000000000000000000000000000';
  static readonly HORIZON_TOPIC =
    '0x314d204f00000000000000000000000000000000000000000000000000000000';
  static readonly LB_IN_SEC_TOPIC =
    '0x538e285c00000000000000000000000000000000000000000000000000000000';
  static readonly MAX_UNPEG_TOPIC =
    '0xacb21b3100000000000000000000000000000000000000000000000000000000';

  static readonly ANSWER_UPDATED_TOPIC =
    SwaapV1Pool.proxyInterface.getEventTopic('AnswerUpdated');
  public id: Address;
  public addressSubscribers: Address[];
  public oracleTokenMap: { [oracleAddress: Address]: Address };
  public tokens: Address[];

  constructor(
    dexKey: string,
    network: number,
    protected pool: SubgraphPoolBase,
    protected dexHelper: IDexHelper,
  ) {
    super(
      `${dexKey}-${pool.id}`,
      dexHelper.getLogger(`${dexKey}-${network}-${pool.id}`),
    );

    this.id = pool.id;
    this.tokens = pool.tokens.map(t => t.address);

    this.addressSubscribers = [pool.id];
    this.oracleTokenMap = pool.tokens.reduce((acc, t) => {
      this.addressSubscribers.push(
        t.oracleInitialState.aggregator.toLowerCase(),
      );
      return {
        ...acc,
        [t.oracleInitialState.aggregator.toLowerCase()]: t.address,
      };
    }, {});
  }

  // Function which transforms the given state for the given log event.
  // If the provided log does not affect the state, return null.
  public async processLog(
    state: DeepReadonly<SwaapV1PoolState>,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<DeepReadonly<SwaapV1PoolState> | null> {
    try {
      const tokenAddress = this.oracleTokenMap[log.address.toLowerCase()];

      if (tokenAddress) {
        // log comes from a subscribed oracle

        if (log.topics[0] != SwaapV1Pool.ANSWER_UPDATED_TOPIC) return null;
        const decoded = SwaapV1Pool.proxyInterface.decodeEventLog(
          'AnswerUpdated',
          log.data,
          log.topics,
        );
        const latestRoundId = Number(decoded.roundId.toString());
        const latestRoundData = {
          answer: BigInt(decoded.current.toString()),
          timestamp: BigInt(decoded.updatedAt.toString()),
        };

        let previousRoundId = state.oracles[tokenAddress].latestRoundId;

        if (previousRoundId == latestRoundId) {
          return null;
        }

        let updatedHistoricalState = {
          ...state.oracles[tokenAddress].historicalOracleState,
        };
        const roundLookbackWindow =
          (state.parameters.priceStatisticsLookbackInRound - 1) *
          state.parameters.priceStatisticsLookbackStepInRound;

        // Case where roundIds are skipped
        while (latestRoundId > previousRoundId + 1) {
          delete updatedHistoricalState[previousRoundId - roundLookbackWindow];
          updatedHistoricalState[++previousRoundId] = {
            answer: 0n,
            timestamp: 0n,
          };
        }

        delete updatedHistoricalState[previousRoundId - roundLookbackWindow];
        updatedHistoricalState[latestRoundId] = latestRoundData;

        return {
          ...state,
          oracles: {
            ...state.oracles,
            [tokenAddress]: {
              ...state.oracles[tokenAddress],
              latestRoundId: latestRoundId,
              historicalOracleState: updatedHistoricalState,
            },
          },
        };
      } else if (this.pool.id === log.address.toLowerCase()) {
        // log comes from the Pool

        const topic0 = log.topics[0];

        // anonymous events
        switch (topic0) {
          // setSwapFee
          case SwaapV1Pool.SWAP_FEE_TOPIC: {
            const value = BigInt(SwaapV1Pool.getValueFromAnonymousEvent(log));
            return {
              ...state,
              parameters: {
                ...state.parameters,
                swapFee: value,
              },
            };
          }
          // setPriceStatisticsLookbackInRound
          case SwaapV1Pool.LB_IN_ROUND_TOPIC: {
            const value = Number(SwaapV1Pool.getValueFromAnonymousEvent(log));

            const oldRoundLookbackWindow =
              (state.parameters.priceStatisticsLookbackInRound - 1) *
              state.parameters.priceStatisticsLookbackStepInRound;
            const newRoundLookbackWindow =
              (value - 1) * state.parameters.priceStatisticsLookbackStepInRound;
            const tokens = Object.keys(state.oracles);

            if (value > state.parameters.priceStatisticsLookbackInRound) {
              const multiCallInputs: MultiCallInput[] = tokens
                .map((token: Address) => {
                  return [
                    {
                      target: state.oracles[token].oraclesBindState.proxy,
                      callData:
                        SwaapV1Pool.proxyInterface.encodeFunctionData(
                          'latestRound',
                        ),
                    },
                  ];
                })
                .flat();

              const multicallOutputs: MultiCallOutput[] = (
                await this.dexHelper.multiContract.methods
                  .aggregate(multiCallInputs)
                  .call({}, blockHeader.number)
              ).returnData;

              let i = 0;
              const latestRoundIdsBN: { [key: Address]: bigint } =
                tokens.reduce((acc, token) => {
                  return {
                    ...acc,
                    [token]: BigInt(
                      SwaapV1Pool.proxyInterface
                        .decodeFunctionResult(
                          'latestRound',
                          multicallOutputs[i++],
                        )[0]
                        .toString(),
                    ),
                  };
                }, {});

              const missingHistoricalData: { [key: Address]: ChainLinkData } =
                await this.getHistoricalRoundsData(
                  tokens,
                  newRoundLookbackWindow,
                  latestRoundIdsBN,
                  state.oracles,
                  blockHeader.number,
                );

              const updatedOraclesData: SwaapV1PoolOracles = tokens.reduce(
                (acc, token) => {
                  return {
                    ...acc,
                    [token]: {
                      oraclesBindState: {
                        ...state.oracles[token].oraclesBindState,
                      },
                      latestRoundId: state.oracles[token].latestRoundId,
                      historicalOracleState: missingHistoricalData[token],
                    },
                  };
                },
                {},
              );

              return {
                ...state,
                parameters: {
                  ...state.parameters,
                  priceStatisticsLookbackInRound: value,
                },
                oracles: { ...updatedOraclesData },
              };
            } else if (
              value < state.parameters.priceStatisticsLookbackInRound
            ) {
              const updatedOraclesData = tokens.reduce((acc, token) => {
                let historicalData = {
                  ...state.oracles[token].historicalOracleState,
                };
                let roundId =
                  state.oracles[token].latestRoundId - oldRoundLookbackWindow;
                const endRoundId =
                  state.oracles[token].latestRoundId - newRoundLookbackWindow;

                while (roundId < endRoundId) {
                  delete historicalData[roundId++];
                }
                return {
                  ...acc,
                  [token]: {
                    oraclesBindState: {
                      ...state.oracles[token].oraclesBindState,
                    },
                    latestRoundId: state.oracles[token].latestRoundId,
                    historicalOracleState: {
                      historicalData,
                    },
                  },
                };
              }, {});

              return {
                ...state,
                parameters: {
                  ...state.parameters,
                  priceStatisticsLookbackInRound: value,
                },
                oracles: updatedOraclesData,
              };
            }

            return null;
          }
          // setPriceStatisticsLookbackStepInRound
          case SwaapV1Pool.LB_STEP_IN_ROUND_TOPIC: {
            const data = log.data.toString();
            const value = Number(SwaapV1Pool.getValueFromAnonymousEvent(log));
            const oldRoundLookbackWindow =
              (state.parameters.priceStatisticsLookbackInRound - 1) *
              state.parameters.priceStatisticsLookbackStepInRound;
            const newRoundLookbackWindow =
              (state.parameters.priceStatisticsLookbackInRound - 1) * value;
            const tokens = Object.keys(state.oracles);

            if (value > state.parameters.priceStatisticsLookbackStepInRound) {
              const multiCallInputs: MultiCallInput[] = tokens
                .map((token: Address) => {
                  return [
                    {
                      target: state.oracles[token].oraclesBindState.proxy,
                      callData:
                        SwaapV1Pool.proxyInterface.encodeFunctionData(
                          'latestRound',
                        ),
                    },
                  ];
                })
                .flat();

              const multicallOutputs: MultiCallOutput[] = (
                await this.dexHelper.multiContract.methods
                  .aggregate(multiCallInputs)
                  .call({}, blockHeader.number)
              ).returnData;

              let i = 0;
              const latestRoundIdsBN: { [key: Address]: bigint } =
                tokens.reduce((acc, token) => {
                  return {
                    ...acc,
                    [token]: BigInt(
                      SwaapV1Pool.proxyInterface
                        .decodeFunctionResult(
                          'latestRound',
                          multicallOutputs[i++],
                        )[0]
                        .toString(),
                    ),
                  };
                }, {});

              const missingHistoricalData: { [key: Address]: ChainLinkData } =
                await this.getHistoricalRoundsData(
                  tokens,
                  newRoundLookbackWindow,
                  latestRoundIdsBN,
                  state.oracles,
                  blockHeader.number,
                );

              const updatedOraclesData: SwaapV1PoolOracles = tokens.reduce(
                (acc, token) => {
                  return {
                    ...acc,
                    [token]: {
                      oraclesBindState: {
                        ...state.oracles[token].oraclesBindState,
                      },
                      latestRoundId: state.oracles[token].latestRoundId,
                      historicalOracleState: missingHistoricalData[token],
                    },
                  };
                },
                {},
              );

              return {
                ...state,
                parameters: {
                  ...state.parameters,
                  priceStatisticsLookbackStepInRound: value,
                },
                oracles: { ...updatedOraclesData },
              };
            } else if (
              value < state.parameters.priceStatisticsLookbackStepInRound
            ) {
              const updatedOraclesData = tokens.reduce((acc, token) => {
                let historicalData = {
                  ...state.oracles[token].historicalOracleState,
                };
                let roundId =
                  state.oracles[token].latestRoundId - oldRoundLookbackWindow;
                const endRoundId =
                  state.oracles[token].latestRoundId - newRoundLookbackWindow;

                while (roundId < endRoundId) {
                  delete historicalData[roundId++];
                }
                return {
                  ...acc,
                  [token]: {
                    oraclesBindState: {
                      ...state.oracles[token].oraclesBindState,
                    },
                    latestRoundId: state.oracles[token].latestRoundId,
                    historicalOracleState: {
                      historicalData,
                    },
                  },
                };
              }, {});

              return {
                ...state,
                parameters: {
                  ...state.parameters,
                  priceStatisticsLookbackStepInRound: value,
                },
                oracles: updatedOraclesData,
              };
            }

            return {
              ...state,
              parameters: {
                ...state.parameters,
                priceStatisticsLookbackStepInRound: value,
              },
            };
          }
          // setDynamicCoverageFeesZ
          case SwaapV1Pool.Z_TOPIC: {
            const value = BigInt(SwaapV1Pool.getValueFromAnonymousEvent(log));
            return {
              ...state,
              parameters: {
                ...state.parameters,
                dynamicCoverageFeesZ: value,
              },
            };
          }
          // setDynamicCoverageFeesHorizon
          case SwaapV1Pool.HORIZON_TOPIC: {
            const value = BigInt(SwaapV1Pool.getValueFromAnonymousEvent(log));
            return {
              ...state,
              parameters: {
                ...state.parameters,
                dynamicCoverageFeesHorizon: value,
              },
            };
          }
          // setPriceStatisticsLookbackInSec
          case SwaapV1Pool.LB_IN_SEC_TOPIC: {
            const value = BigInt(SwaapV1Pool.getValueFromAnonymousEvent(log));
            return {
              ...state,
              parameters: {
                ...state.parameters,
                priceStatisticsLookbackInSec: value,
              },
            };
          }
          // setMaxPriceUnpegRatio
          case SwaapV1Pool.MAX_UNPEG_TOPIC: {
            const value = BigInt(SwaapV1Pool.getValueFromAnonymousEvent(log));
            return {
              ...state,
              parameters: {
                ...state.parameters,
                maxPriceUnpegRatio: value,
              },
            };
          }
        }

        const parsed = SwaapV1Pool.poolInterface.parseLog(log);

        // named events
        switch (parsed.name) {
          case 'LOG_JOIN': {
            const tokenIn = parsed.args.tokenIn.toString().toLowerCase();
            const tokenAmountIn = BigInt(parsed.args.tokenAmountIn.toString());
            return {
              ...state,
              liquidities: {
                ...state.liquidities,
                [tokenIn]: {
                  ...state.liquidities[tokenIn],
                  balance: state.liquidities[tokenIn].balance + tokenAmountIn,
                },
              },
            };
          }
          case 'LOG_EXIT': {
            const tokenOut = parsed.args.tokenOut.toString().toLowerCase();
            const tokenAmountOut = BigInt(
              parsed.args.tokenAmountOut.toString(),
            );
            return {
              ...state,
              liquidities: {
                ...state.liquidities,
                [tokenOut]: {
                  ...state.liquidities[tokenOut],
                  balance: state.liquidities[tokenOut].balance - tokenAmountOut,
                },
              },
            };
          }
          case 'LOG_SWAP': {
            const tokenIn = parsed.args.tokenIn.toString().toLowerCase();
            const tokenAmountIn = BigInt(parsed.args.tokenAmountIn.toString());
            const tokenOut = parsed.args.tokenOut.toString().toLowerCase();
            const tokenAmountOut = BigInt(
              parsed.args.tokenAmountOut.toString(),
            );
            return {
              ...state,
              liquidities: {
                ...state.liquidities,
                [tokenIn]: {
                  ...state.liquidities[tokenIn],
                  balance: state.liquidities[tokenIn].balance + tokenAmountIn,
                },
                [tokenOut]: {
                  ...state.liquidities[tokenOut],
                  balance: state.liquidities[tokenOut].balance - tokenAmountOut,
                },
              },
            };
          }
          default: {
            return null;
          }
        }
      }

      return null;
    } catch (e) {
      this.logger.error('Failed to decode result', e);
      return null;
    }
  }

  public async getTokensAndParameters(
    blockNumber: number,
  ): Promise<[Address[], SwaapV1PoolParameters]> {
    const multiCallInputs: MultiCallInput[] = [
      {
        target: this.pool.id,
        callData: SwaapV1Pool.poolInterface.encodeFunctionData('getTokens'),
      },
      {
        target: this.pool.id,
        callData: SwaapV1Pool.poolInterface.encodeFunctionData(
          'getCoverageParameters',
        ),
      },
      {
        target: this.pool.id,
        callData: SwaapV1Pool.poolInterface.encodeFunctionData('getSwapFee'),
      },
    ];

    const returnData: MultiCallOutput[] = (
      await this.dexHelper.multiContract.methods
        .aggregate(multiCallInputs)
        .call({}, blockNumber)
    ).returnData;

    let tokens: Address[] = SwaapV1Pool.poolInterface.decodeFunctionResult(
      'getTokens',
      returnData[0],
    )[0];
    tokens = tokens.map(t => t.toLowerCase());

    const coverageParameters = SwaapV1Pool.poolInterface.decodeFunctionResult(
      'getCoverageParameters',
      returnData[1],
    );

    const parameters: SwaapV1PoolParameters = {
      swapFee: BigInt(
        SwaapV1Pool.poolInterface
          .decodeFunctionResult('getSwapFee', returnData[2])[0]
          .toString(),
      ),
      priceStatisticsLookbackInRound: Number(coverageParameters[0].toString()),
      priceStatisticsLookbackStepInRound: Number(
        coverageParameters[1].toString(),
      ),
      dynamicCoverageFeesZ: BigInt(coverageParameters[2].toString()),
      dynamicCoverageFeesHorizon: BigInt(coverageParameters[3].toString()),
      priceStatisticsLookbackInSec: BigInt(coverageParameters[4].toString()),
      maxPriceUnpegRatio: BigInt(coverageParameters[5].toString()),
    };

    return [tokens, parameters];
  }

  public async getProxiesAndLiquidities(
    tokens: Address[],
    blockNumber: number,
  ): Promise<[{ [key: Address]: Address }, SwaapV1PoolLiquidities]> {
    let multiCallInputs: MultiCallInput[] = tokens
      .map(token => {
        return [
          {
            target: this.pool.id,
            callData: SwaapV1Pool.poolInterface.encodeFunctionData(
              'getBalance',
              [token],
            ),
          },
          {
            target: this.pool.id,
            callData: SwaapV1Pool.poolInterface.encodeFunctionData(
              'getDenormalizedWeight',
              [token],
            ),
          },
          {
            target: token,
            callData: SwaapV1Pool.erc20Interface.encodeFunctionData('decimals'),
          },
        ];
      })
      .flat();

    multiCallInputs = tokens.reduce((acc, token) => {
      return [
        ...acc,
        {
          target: this.pool.id,
          callData: SwaapV1Pool.poolInterface.encodeFunctionData(
            'getTokenPriceOracle',
            [token],
          ),
        },
      ].flat();
    }, multiCallInputs);

    let multicallOutputs: MultiCallOutput[] = (
      await this.dexHelper.multiContract.methods
        .aggregate(multiCallInputs)
        .call({}, blockNumber)
    ).returnData;

    let idx = 0;
    // get liquidities
    const liquidities = tokens.reduce((acc, token) => {
      const balance = BigInt(
        SwaapV1Pool.poolInterface
          .decodeFunctionResult('getBalance', multicallOutputs[idx++])[0]
          .toString(),
      );
      const initialWeight = BigInt(
        SwaapV1Pool.poolInterface
          .decodeFunctionResult(
            'getDenormalizedWeight',
            multicallOutputs[idx++],
          )[0]
          .toString(),
      );
      const decimals = parseInt(
        SwaapV1Pool.erc20Interface
          .decodeFunctionResult('decimals', multicallOutputs[idx++])[0]
          .toString(),
      );
      return {
        ...acc,
        [token]: {
          balance: balance,
          initialWeight: initialWeight,
          decimals: decimals,
        },
      };
    }, {});

    const oracles = tokens.reduce((acc, token) => {
      const oracle: Address = SwaapV1Pool.poolInterface
        .decodeFunctionResult('getTokenPriceOracle', multicallOutputs[idx++])[0]
        .toString()
        .toLowerCase();

      return {
        ...acc,
        [token]: oracle,
      };
    }, {});

    return [oracles, liquidities];
  }

  public async getOraclesData(
    tokens: Address[],
    proxies: { [key: Address]: Address }, // key: token, value: proxy
    parameters: SwaapV1PoolParameters,
    blockNumber: number,
  ): Promise<SwaapV1PoolOracles> {
    // aggregators
    let multiCallInputs: MultiCallInput[] = tokens.map((token: Address) => {
      return {
        target: proxies[token],
        callData: SwaapV1Pool.proxyInterface.encodeFunctionData('aggregator'),
      };
    });

    // oracle's addresses
    let multicallOutputs: MultiCallOutput[] = (
      await this.dexHelper.multiContract.methods
        .aggregate(multiCallInputs)
        .call({}, blockNumber)
    ).returnData;

    let i: number = 0;
    const oracles: { [key: Address]: Address } = tokens.reduce((acc, token) => {
      return {
        ...acc,
        [token]: SwaapV1Pool.poolInterface
          .decodeFunctionResult('getTokenPriceOracle', multicallOutputs[i++])[0]
          .toString()
          .toLowerCase(),
      };
    }, {});

    multiCallInputs = tokens
      .map((token: Address) => {
        return [
          {
            target: this.pool.id,
            callData: SwaapV1Pool.poolInterface.encodeFunctionData(
              'getTokenOracleInitialPrice',
              [token],
            ),
          },
          {
            target: proxies[token],
            callData: SwaapV1Pool.proxyInterface.encodeFunctionData('decimals'),
          },
          {
            target: proxies[token],
            callData:
              SwaapV1Pool.proxyInterface.encodeFunctionData('description'),
          },
          {
            target: proxies[token],
            callData:
              SwaapV1Pool.proxyInterface.encodeFunctionData('latestRoundData'),
          },
        ];
      })
      .flat();

    multicallOutputs = (
      await this.dexHelper.multiContract.methods
        .aggregate(multiCallInputs)
        .call({}, blockNumber)
    ).returnData;

    let latestRoundIdsBN: { [key: Address]: bigint } = {};

    i = 0;
    let oraclesData: SwaapV1PoolOracles = tokens.reduce((acc, token) => {
      const oraclesBindState: OracleInitialData = {
        proxy: proxies[token],
        aggregator: oracles[token],
        price: BigInt(
          SwaapV1Pool.poolInterface
            .decodeFunctionResult(
              'getTokenOracleInitialPrice',
              multicallOutputs[i++],
            )[0]
            .toString(),
        ),
        decimals: Number(
          SwaapV1Pool.proxyInterface
            .decodeFunctionResult('decimals', multicallOutputs[i++])[0]
            .toString(),
        ),
        description: SwaapV1Pool.proxyInterface
          .decodeFunctionResult('description', multicallOutputs[i++])[0]
          .toString(),
      };

      const latestRoundData = SwaapV1Pool.proxyInterface.decodeFunctionResult(
        'latestRoundData',
        multicallOutputs[i++],
      );
      const latestRoundId = BigInt(latestRoundData.roundId.toString());
      latestRoundIdsBN[token] = latestRoundId;
      return {
        ...acc,
        [token]: {
          oraclesBindState: oraclesBindState,
          latestRoundId: Number(latestRoundId % 2n ** 64n),
          historicalOracleState: {
            [Number(latestRoundId % 2n ** 64n)]: {
              answer: BigInt(latestRoundData.answer.toString()),
              timestamp: BigInt(latestRoundData.updatedAt.toString()),
            },
          },
        },
      };
    }, {});

    const roundLookbackWindow =
      (parameters.priceStatisticsLookbackInRound - 1) *
      parameters.priceStatisticsLookbackStepInRound;

    const historicalRoundsData = await this.getHistoricalRoundsData(
      tokens,
      roundLookbackWindow,
      latestRoundIdsBN,
      oraclesData,
      blockNumber,
    );

    tokens.forEach(token => {
      oraclesData[token].historicalOracleState = historicalRoundsData[token];
    });

    return oraclesData;
  }

  public async getHistoricalRoundsData(
    tokens: Address[],
    roundLookbackWindow: number,
    latestRoundIdsBN: { [key: Address]: bigint },
    oraclesData: SwaapV1PoolOracles,
    blockNumber: number,
  ): Promise<{ [key: Address]: ChainLinkData }> {
    // historical round data
    let historicalStates: { [key: Address]: ChainLinkData } = tokens.reduce(
      (acc, token) => {
        return {
          ...acc,
          [token]: { ...oraclesData[token].historicalOracleState },
        };
      },
      {},
    );
    let multiCallInputs = tokens
      .map((token: Address) => {
        const startRoundId: bigint = latestRoundIdsBN[token];
        return Array.from({ length: roundLookbackWindow }, (x, idx) => idx)
          .map(idx => {
            return {
              target: oraclesData[token].oraclesBindState.proxy,
              callData: SwaapV1Pool.proxyInterface.encodeFunctionData(
                'getRoundData',
                [startRoundId - BigInt(idx + 1)],
              ),
            };
          })
          .flat();
      })
      .flat();

    try {
      let multicallOutputs = (
        await this.dexHelper.multiContract.methods
          .aggregate(multiCallInputs)
          .call({}, blockNumber)
      ).returnData;

      let i = 0;
      tokens.map(token => {
        Array.from({ length: roundLookbackWindow }, (x, idx) => idx).map(
          idx => {
            const decoded = SwaapV1Pool.proxyInterface.decodeFunctionResult(
              'getRoundData',
              multicallOutputs[i++],
            );
            const roundId = Number(
              BigInt(decoded.roundId.toString()) % 2n ** 64n,
            );

            historicalStates[token][roundId] = {
              answer: BigInt(decoded.answer.toString()),
              timestamp: BigInt(decoded.updatedAt.toString()),
            };
          },
        );
      });
    } catch (e) {
      this.logger.error('Failed to get historical round data', e);
    }

    return historicalStates;
  }

  //Function used to generate a state if one is not currently present, which
  //must be the state at exactly the given block number, unless one is not
  //provided, in which case one should be generated for latest block.  This
  //function should not use any previous states to derive a new state, it should
  //generate one from scratch.
  public async generateState(
    blockNumber?: number | 'latest',
  ): Promise<DeepReadonly<SwaapV1PoolState>> {
    if (blockNumber === 'latest' || blockNumber === undefined) {
      blockNumber = await this.dexHelper.provider.getBlockNumber();
    }

    const [tokens, parameters] = await this.getTokensAndParameters(blockNumber);
    const [proxies, liquidities] = await this.getProxiesAndLiquidities(
      tokens,
      blockNumber,
    );
    const oracles = await this.getOraclesData(
      tokens,
      proxies,
      parameters,
      blockNumber,
    );

    return {
      parameters: parameters,
      liquidities: liquidities,
      oracles: oracles,
    };
  }

  static getValueFromAnonymousEvent(log: Readonly<Log>): string {
    const data = log.data.toString();
    const startIdx = 2 + 64 + 64 + 8;
    return '0x' + data.slice(startIdx, startIdx + 64).toString();
  }
}
