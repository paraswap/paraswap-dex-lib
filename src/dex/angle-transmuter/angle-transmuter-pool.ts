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
  Oracle,
  OracleFeed,
  OracleQuoteType,
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
import {
  _quoteBurnExactInput,
  _quoteBurnExactOutput,
  _quoteMintExactInput,
  _quoteMintExactOutput,
} from './utils';
import { RedstoneSubscriber } from './redstone';
import { formatUnits } from 'ethers/lib/utils';
import { BackedSubscriber } from './backedOracle';
import { SwapSide } from '../../constants';

export class AngleTransmuterEventPool extends ComposedEventSubscriber<PoolState> {
  public transmuter: Contract;
  static angleTransmuterIface = new Interface(TransmuterABI);
  readonly config: PoolConfig;

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
    const backedMap = Object.entries(config.oracles.backed).reduce(
      (
        acc: { [address: string]: BackedSubscriber<PoolState> },
        [key, value],
      ) => {
        acc[key] = new BackedSubscriber<PoolState>(
          value.proxy,
          value.aggregator,
          lens<DeepReadonly<PoolState>>().oracles.chainlink[key],
          dexHelper.getLogger(`${key} ChainLink for ${parentName}-${network}`),
        );
        return acc;
      },
      {},
    );

    const redstoneMap = Object.entries(config.oracles.redstone).reduce(
      (
        acc: { [address: string]: RedstoneSubscriber<PoolState> },
        [key, value],
      ) => {
        acc[key] = new RedstoneSubscriber<PoolState>(
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
      [
        ...Object.values(chainlinkMap),
        ...Object.values(backedMap),
        ...Object.values(redstoneMap),
        transmuterListener,
        pythListener,
      ],
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

    this.config = config;
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
    side: SwapSide,
    _amounts: number[],
    blockNumber: number,
  ): Promise<number[] | null> {
    // TODO
    const state = await this.getStateOrGenerate(blockNumber);
    const isMint = _tokenOut == state.stablecoin.address;
    let oracleValue: number;
    let minRatio: number;
    let collateral = _tokenIn;
    if (isMint)
      oracleValue = await this._readMint(this.config, state, _tokenIn);
    else {
      collateral = _tokenOut;
      ({ oracleValue, minRatio } = await this._getBurnOracle(
        this.config,
        state,
        _tokenOut,
      ));
    }

    const collatStablecoinIssued =
      state.transmuter.collaterals[collateral].stablecoinsIssued;
    const otherStablecoinIssued =
      state.transmuter.totalStablecoinIssued - collatStablecoinIssued;
    const fees = state.transmuter.collaterals[collateral].fees;
    return _amounts.map(_amount => {
      if (isMint && side == SwapSide.SELL)
        return _quoteMintExactInput(
          oracleValue,
          _amount,
          fees,
          collatStablecoinIssued,
          otherStablecoinIssued,
        );
      else if (isMint && side == SwapSide.BUY)
        return _quoteMintExactOutput(
          oracleValue,
          _amount,
          fees,
          collatStablecoinIssued,
          otherStablecoinIssued,
        );
      else if (!isMint && side == SwapSide.SELL)
        return _quoteBurnExactInput(
          oracleValue,
          minRatio,
          _amount,
          fees,
          collatStablecoinIssued,
          otherStablecoinIssued,
        );
      else
        return _quoteBurnExactOutput(
          oracleValue,
          minRatio,
          _amount,
          fees,
          collatStablecoinIssued,
          otherStablecoinIssued,
        );
    });
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
    const tokens: Address[] =
      TransmuterSubscriber.interface.decodeFunctionResult(
        'getCollateralList',
        tokensResult[0],
      )[0];
    // .map((t: any) => t.toLowerCase());
    return tokens;
  }

  static async _fillMap(
    chainlinkMap: ChainlinkConfig,
    backedMap: ChainlinkConfig,
    redstoneMap: ChainlinkConfig,
    pythIds: PythConfig,
    oracleFeed: OracleFeed,
    blockNumber: number | 'latest',
    multiContract: Contract,
  ): Promise<{
    chainlinkMap: ChainlinkConfig;
    backedMap: ChainlinkConfig;
    redstoneMap: ChainlinkConfig;
    pythIds: PythConfig;
  }> {
    if (oracleFeed.isChainlink) {
      await Promise.all(
        oracleFeed.chainlink!.circuitChainlink.map(async feed => {
          let aggreagator: Address;
          let decimals: number;
          // it can be Chainlink or Redstone feed
          // if the call getReadAggregatorMultiCallInput fail with a Chainlink instance
          // then it is a Redstone one
          try {
            // Chainlink
            const proxyResult = (
              await multiContract.methods
                .aggregate([
                  ChainLinkSubscriber.getReadAggregatorMultiCallInput(feed),
                  ChainLinkSubscriber.getReadDecimal(feed),
                ])
                .call({}, blockNumber)
            ).returnData;
            aggreagator = ChainLinkSubscriber.readAggregator(proxyResult[0]);
            decimals = Number(ChainLinkSubscriber.readDecimals(proxyResult[1]));
            chainlinkMap[feed] = {
              proxy: feed,
              aggregator: aggreagator,
              decimals: decimals,
            };
          } catch {
            try {
              // Redstone
              const proxyResult = (
                await multiContract.methods
                  .aggregate([
                    RedstoneSubscriber.getReadAggregatorMultiCallInput(feed),
                    RedstoneSubscriber.getReadDecimal(feed),
                  ])
                  .call({}, blockNumber)
              ).returnData;
              aggreagator = RedstoneSubscriber.readAggregator(proxyResult[0]);
              decimals = Number(
                RedstoneSubscriber.readDecimals(proxyResult[1]),
              );
              redstoneMap[feed] = {
                proxy: feed,
                aggregator: aggreagator,
                decimals: decimals,
              };
            } catch {
              // Backed
              const proxyResult = (
                await multiContract.methods
                  .aggregate([ChainLinkSubscriber.getReadDecimal(feed)])
                  .call({}, blockNumber)
              ).returnData;
              decimals = Number(
                ChainLinkSubscriber.readDecimals(proxyResult[0]),
              );
              backedMap[feed] = {
                proxy: feed,
                aggregator: feed,
                decimals: decimals,
              };
            }
          }
        }),
      );
    } else if (oracleFeed.isPyth) {
      pythIds.ids = pythIds.ids.concat(oracleFeed.pyth!.feedIds);
    } else {
      // TODO fill the staked ETH feed
      throw new Error('Unknown oracle feed');
    }
    return { chainlinkMap, backedMap, redstoneMap, pythIds };
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

    let chainlinkMap: ChainlinkConfig = {} as ChainlinkConfig;
    let backedMap: ChainlinkConfig = {} as ChainlinkConfig;
    let redstoneMap: ChainlinkConfig = {} as ChainlinkConfig;
    let pythIds: PythConfig = { proxy: pythAddress, ids: [] } as PythConfig;

    await Promise.all(
      oracleConfigs.map(async oracleConfigDecoded => {
        if (oracleConfigDecoded.oracleType !== OracleReadType.EXTERNAL) {
          // add all the feed oracles used to their respective channels
          if (
            oracleConfigDecoded.oracleType == OracleReadType.CHAINLINK_FEEDS ||
            oracleConfigDecoded.oracleType == OracleReadType.PYTH
          ) {
            const oracleFeed = TransmuterSubscriber._decodeOracleFeed(
              oracleConfigDecoded.oracleType,
              oracleConfigDecoded.oracleData,
            );
            ({ chainlinkMap, backedMap, redstoneMap, pythIds } =
              await this._fillMap(
                chainlinkMap,
                backedMap,
                redstoneMap,
                pythIds,
                oracleFeed,
                blockNumber,
                multiContract,
              ));
          }
          if (
            oracleConfigDecoded.targetType == OracleReadType.CHAINLINK_FEEDS ||
            oracleConfigDecoded.targetType == OracleReadType.PYTH
          ) {
            const oracleFeed = TransmuterSubscriber._decodeOracleFeed(
              oracleConfigDecoded.targetType,
              oracleConfigDecoded.targetData,
            );
            ({ chainlinkMap, backedMap, redstoneMap, pythIds } =
              await this._fillMap(
                chainlinkMap,
                backedMap,
                redstoneMap,
                pythIds,
                oracleFeed,
                blockNumber,
                multiContract,
              ));
          }
        }
      }),
    );
    return {
      chainlink: chainlinkMap,
      backed: backedMap,
      redstone: redstoneMap,
      pyth: pythIds,
    };
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

  /*//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                       UTILS                                                      
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/

  _readMint(config: PoolConfig, state: PoolState, collateral: Address): number {
    const configOracle =
      state.transmuter.collaterals[collateral].oracles.config;
    if (configOracle.oracleType == OracleReadType.EXTERNAL) {
      return 1;
    } else {
      const targetPrice = this._read(
        config,
        state,
        configOracle.targetType,
        configOracle.targetFeed,
        1,
      );
      let oracleValue = this._read(
        config,
        state,
        configOracle.oracleType,
        configOracle.oracleFeed,
        targetPrice,
      );
      if (targetPrice < oracleValue) oracleValue = targetPrice;
      return oracleValue;
    }
  }

  _getBurnOracle(
    config: PoolConfig,
    state: PoolState,
    collateral: Address,
  ): { oracleValue: number; minRatio: number } {
    return config.collaterals.reduce(
      (
        acc: { oracleValue: number; minRatio: number },
        comparedCollat: string,
        j: number,
      ) => {
        let ratio: number;
        if (comparedCollat.toLowerCase() === collateral.toLowerCase()) {
          let oracleValue: number;
          ({ oracleValue, ratio } = this._readBurn(
            config,
            state,
            comparedCollat,
          ));
          acc.oracleValue = oracleValue;
        } else ({ ratio } = this._readBurn(config, state, comparedCollat));
        if (ratio < acc.minRatio) acc.minRatio = ratio;
        return acc;
      },
      { oracleValue: 0, minRatio: 1 },
    );
  }

  _readBurn(
    config: PoolConfig,
    state: PoolState,
    collateral: Address,
  ): { oracleValue: number; ratio: number } {
    const configOracle =
      state.transmuter.collaterals[collateral].oracles.config;
    if (configOracle.oracleType == OracleReadType.EXTERNAL) {
      return { oracleValue: 1, ratio: 1 };
    } else {
      const targetPrice = this._read(
        config,
        state,
        configOracle.targetType,
        configOracle.targetFeed,
        1,
      );
      const oracleValue = this._read(
        config,
        state,
        configOracle.oracleType,
        configOracle.oracleFeed,
        targetPrice,
      );
      let ratio = 1;
      if (targetPrice < oracleValue) ratio = oracleValue / targetPrice;
      return { oracleValue, ratio };
    }
  }

  _quoteAmount(quoteType: OracleQuoteType, baseValue: number): number {
    if (quoteType === OracleQuoteType.UNIT) return 1;
    else return baseValue;
  }

  _read(
    config: PoolConfig,
    state: PoolState,
    oracleType: OracleReadType,
    feed: OracleFeed,
    baseValue: number,
  ): number {
    let price = 1;
    if (oracleType == OracleReadType.CHAINLINK_FEEDS) {
      price = this._quoteAmount(feed.chainlink!.quoteType, baseValue);
      for (let i = 0; i < feed.chainlink!.circuitChainlink.length; i++) {
        const id = feed.chainlink!.circuitChainlink[i];
        let decimals;
        if (Object.keys(config.oracles.chainlink).includes(id))
          decimals = config.oracles.chainlink[id].decimals;
        else if (Object.keys(config.oracles.redstone).includes(id))
          decimals = config.oracles.redstone[id].decimals;
        else decimals = config.oracles.backed[id].decimals;
        const rate = parseFloat(
          formatUnits(state.oracles.chainlink[id].answer.toString(), decimals),
        );
        if (feed.chainlink!.circuitChainIsMultiplied[i] == 1) price *= rate;
        else price /= rate;
      }
    } else if (oracleType == OracleReadType.PYTH) {
      price = this._quoteAmount(feed.pyth!.quoteType, baseValue);
      for (let i = 0; i < feed.pyth!.feedIds.length; i++) {
        const id = feed.pyth!.feedIds[i];
        const rate = state.oracles.pyth[id].answer;
        if (feed.pyth!.isMultiplied[i] == 1) price *= rate;
        else price /= rate;
      }
    } else if (oracleType == OracleReadType.STABLE) {
      price = 1;
    } else if (oracleType == OracleReadType.NO_ORACLE) {
      price = baseValue;
    }
    return price;
  }
}
