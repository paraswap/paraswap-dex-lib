import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { lens } from '../../lens';
import { Address, Logger, Token } from '../../types';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  ChainlinkConfig,
  DexParams,
  OracleReadType,
  PoolConfig,
  PoolState,
  PythConfig,
  TransmuterState,
} from './types';
import TransmuterABI from '../../abi/angle-transmuter/Transmuter.json';
import { CBETH, RETH, SFRXETH, STETH } from './constants';
import { Contract } from 'web3-eth-contract';
import { TransmuterSubscriber } from './transmuter';
import { PythSubscriber } from './pyth';
import { _quoteBurnExactInput, _quoteMintExactInput } from './utils';

export class AngleTransmuterEventPool extends ComposedEventSubscriber<PoolState> {
  public transmuter: Contract;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    config: PoolConfig,
    protected angleTransmuterIface = new Interface(TransmuterABI),
  ) {
    const chainlinkMap = Object.entries(config.oracles.chainlink).reduce(
      (
        acc: { [address: string]: ChainLinkSubscriber<PoolState> },
        [key, value],
      ) => {
        acc[key] = new ChainLinkSubscriber<PoolState>(
          value.proxy,
          value.aggregator,
          lens<DeepReadonly<PoolState>>().oracles.chainlink[key],
          dexHelper.getLogger(`${key} ChainLink for ${parentName}-${network}`),
        );
        return acc;
      },
      {},
    );

    const pythListener = new PythSubscriber<PoolState>(
      config.oracles.pyth.proxy,
      config.oracles.pyth.ids,
      lens<DeepReadonly<PoolState>>().oracles.pyth,
      dexHelper.getLogger(`Pyth for ${parentName}-${network}`),
    );

    const transmuterListener = new TransmuterSubscriber(
      config.agEUR.address,
      config.transmuter,
      config.collaterals,
      lens<DeepReadonly<PoolState>>().transmuter,
      dexHelper.getLogger(`${parentName}-${network} Transmuter`),
    );

    super(
      parentName,
      'Transmuter',
      dexHelper.getLogger(`${parentName}-${network}`),
      dexHelper,
      [...Object.values(chainlinkMap), transmuterListener, pythListener],
      {
        // TODO: poolState is the state of event
        // subscriber. This should be the minimum
        // set of parameters required to compute
        // pool prices. Complete me!
        stablecoin: config.agEUR,
        transmuter: {} as TransmuterState,
        oracles: { chainlink: {}, pyth: {} },
      },
    );

    this.transmuter = new this.dexHelper.web3Provider.eth.Contract(
      TransmuterABI as any,
      config.transmuter,
    );
  }

  async getStateOrGenerate(blockNumber: number): Promise<Readonly<PoolState>> {
    const evenState = this.getState(blockNumber);
    if (evenState) return evenState as PoolState;
    const onChainState = await this.generateState(blockNumber);
    this.setState(onChainState, blockNumber);
    return onChainState as PoolState;
  }

  // Reference to the original implementation
  // https://github.com/AngleProtocol/angle-transmuter/blob/6e1f2eb1f961d6c3b1cdaefe068d967c33c41936/contracts/transmuter/facets/Swapper.sol#L177
  async getAmountOut(
    _tokenIn: Address,
    _tokenOut: Address,
    _amountsIn: number[],
    blockNumber: number,
  ): Promise<number[] | null> {
    // TODO
    const state = await this.getStateOrGenerate(blockNumber);

    const isMint = _tokenOut == state.stablecoin.address;
    let oracleValue: number;
    let ratio: number;

    if (isMint)
      oracleValue = await this.getMintOraclePrice(_tokenIn, _tokenOut);
    else
      ({ oracleValue, ratio } = await this.getBurnOraclePrice(
        _tokenIn,
        _tokenOut,
      ));

    const collatStablecoinIssued =
      state.transmuter.collaterals[_tokenIn].stablecoinsIssued;
    const otherStablecoinIssued =
      state.transmuter.totalStablecoinIssued - collatStablecoinIssued;
    const fees = state.transmuter.collaterals[_tokenIn].fees;
    return _amountsIn.map(_amountIn => {
      if (isMint)
        return _quoteMintExactInput(
          oracleValue,
          _amountIn,
          fees,
          collatStablecoinIssued,
          otherStablecoinIssued,
        );
      else
        return _quoteBurnExactInput(
          oracleValue,
          ratio,
          _amountIn,
          fees,
          collatStablecoinIssued,
          otherStablecoinIssued,
        );
    });
  }

  // TODO
  async getMintOraclePrice(
    _tokenIn: Address,
    _tokenOut: Address,
  ): Promise<number> {
    return 0;
  }

  async getBurnOraclePrice(
    _tokenIn: Address,
    _tokenOut: Address,
  ): Promise<{ oracleValue: number; ratio: number }> {
    return { oracleValue: 0, ratio: 0 };
  }

  static async getCollateralsList(
    transmuterAddress: Address,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ) {
    const tokensResult = (
      await multiContract.methods
        .aggregate([
          {
            target: transmuterAddress,
            callData:
              TransmuterSubscriber.interface.encodeFunctionData(
                'getCollateralList',
              ),
          },
        ])
        .call({}, blockNumber)
    ).returnData;
    const tokens: Address[] = tokensResult.map((t: any) =>
      TransmuterSubscriber.interface
        .decodeFunctionResult('getCollateralList', tokensResult)[0]
        .toLowerCase(),
    );
    return tokens;
  }

  static async getOraclesConfig(
    transmuterAddress: Address,
    pythAddress: Address,
    collaterals: Address[],
    blockNumber: number | 'latest',
    multiContract: Contract,
  ) {
    const getOracleConfigData = collaterals.map(collat => {
      return {
        callData: TransmuterSubscriber.interface.encodeFunctionData(
          'getOracle',
          [collat],
        ),
        target: transmuterAddress,
      };
    });
    const oracleConfigResult = (
      await multiContract.methods
        .aggregate(getOracleConfigData)
        .call({}, blockNumber)
    ).returnData;
    const oracleConfigs: string[] = oracleConfigResult.map(
      (p: any) =>
        TransmuterSubscriber.interface.decodeFunctionResult('priceFeeds', p)[0],
    );

    const chainlinkMap: ChainlinkConfig = {} as ChainlinkConfig;
    const pythIds: PythConfig = { proxy: pythAddress, ids: [] } as PythConfig;

    await Promise.all(
      oracleConfigs.map(async oracle => {
        const oracleConfigDecoded =
          TransmuterSubscriber._decodeOracleConfig(oracle);
        if (oracleConfigDecoded.oracleType !== OracleReadType.EXTERNAL) {
          // add all the feed oracles used to their respective channels
          const oracleFeed = TransmuterSubscriber._decodeOracleFeed(
            oracleConfigDecoded.oracleType,
            oracleConfigDecoded.oracleData,
          );
          if (oracleFeed.isChainlink) {
            await Promise.all(
              oracleFeed.chainlink!.circuitChainlink.map(async feed => {
                const proxyResult = (
                  await multiContract.methods
                    .aggregate([
                      ChainLinkSubscriber.getReadAggregatorMultiCallInput(feed),
                    ])
                    .call({}, blockNumber)
                ).returnData;
                const aggreagator: Address = ChainLinkSubscriber.readAggregator(
                  proxyResult[0],
                );
                chainlinkMap[feed] = {
                  proxy: feed,
                  aggregator: aggreagator,
                };
              }),
            );
          } else if (oracleFeed.isPyth) {
            pythIds.ids = pythIds.ids.concat(oracleFeed.pyth!.feedIds);
          } else {
            // TODO fill the staked ETH feed
            throw new Error('Unknown oracle feed');
          }
        }
      }),
    );

    return { chainlink: chainlinkMap, pyth: pythIds };
  }

  static async getConfig(
    dexParams: DexParams,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ): Promise<PoolConfig> {
    const collaterals = await this.getCollateralsList(
      dexParams.transmuter,
      blockNumber,
      multiContract,
    );

    // get all oracles feed
    const oracles = await this.getOraclesConfig(
      dexParams.transmuter,
      dexParams.pyth,
      collaterals,
      blockNumber,
      multiContract,
    );

    return {
      agEUR: dexParams.agEUR,
      transmuter: dexParams.transmuter,
      collaterals: collaterals,
      oracles: oracles,
    };
  }
}
