import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { lens } from '../../lens';
import { Address, Logger, Token } from '../../types';
import { ComposedEventSubscriber } from '../../composed-event-subscriber';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  ChainlinkConfig,
  DecodedOracleConfig,
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
import { RedstoneSubscriber } from './redstone';

export class AngleTransmuterEventPool extends ComposedEventSubscriber<PoolState> {
  public transmuter: Contract;
  static angleTransmuterIface = new Interface(TransmuterABI);

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    config: PoolConfig,
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
    return 1;
  }

  // TODO
  async getBurnOraclePrice(
    _tokenIn: Address,
    _tokenOut: Address,
  ): Promise<{ oracleValue: number; ratio: number }> {
    return { oracleValue: 1, ratio: 1 };
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
    const tokens: Address[] = TransmuterSubscriber.interface
      .decodeFunctionResult('getCollateralList', tokensResult[0])[0]
      .map((t: any) => t.toLowerCase());
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
    const oracleConfigs: DecodedOracleConfig[] = oracleConfigResult.map(
      (p: any) =>
        TransmuterSubscriber.interface.decodeFunctionResult('getOracle', p),
    );

    const chainlinkMap: ChainlinkConfig = {} as ChainlinkConfig;
    const pythIds: PythConfig = { proxy: pythAddress, ids: [] } as PythConfig;

    await Promise.all(
      oracleConfigs.map(async oracleConfigDecoded => {
        if (oracleConfigDecoded.oracleType !== OracleReadType.EXTERNAL) {
          // add all the feed oracles used to their respective channels
          const oracleFeed = TransmuterSubscriber._decodeOracleFeed(
            oracleConfigDecoded.oracleType,
            oracleConfigDecoded.oracleData,
          );
          if (oracleFeed.isChainlink) {
            await Promise.all(
              oracleFeed.chainlink!.circuitChainlink.map(async feed => {
                let aggreagator: Address;
                // it can be Chainlink or Redstone feed
                // if the call getReadAggregatorMultiCallInput fail with a Chainlink instance
                // then it is a Redstone one
                try {
                  const proxyResult = (
                    await multiContract.methods
                      .aggregate([
                        ChainLinkSubscriber.getReadAggregatorMultiCallInput(
                          feed,
                        ),
                      ])
                      .call({}, blockNumber)
                  ).returnData;
                  aggreagator = ChainLinkSubscriber.readAggregator(
                    proxyResult[0],
                  );
                } catch {
                  const proxyResult = (
                    await multiContract.methods
                      .aggregate([
                        RedstoneSubscriber.getReadAggregatorMultiCallInput(
                          feed,
                        ),
                      ])
                      .call({}, blockNumber)
                  ).returnData;
                  aggreagator = RedstoneSubscriber.readAggregator(
                    proxyResult[0],
                  );
                }
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
