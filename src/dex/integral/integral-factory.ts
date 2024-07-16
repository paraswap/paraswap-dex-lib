import { Interface } from '@ethersproject/abi';
import { LogDescription } from 'ethers/lib/utils';
import { IDexHelper } from '../../dex-helper';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Address, BlockHeader, Log, Logger } from '../../types';
import { FactoryState } from './types';
import IntegralFactoryABI from '../../abi/integral/factory.json';
import IntegralPoolABI from '../../abi/integral/pool.json';
import { addressDecode } from '../../lib/decoders';
import { MultiCallParams } from '../../lib/multi-wrapper';

export type OnPoolCreatedCallback = (
  token0: Address,
  token1: Address,
  poolAddress: Address,
  blockNumber: number,
) => Promise<void>;

export class IntegralFactory extends StatefulEventSubscriber<FactoryState> {
  handlers: {
    [event: string]: (
      event: any,
      state: FactoryState,
      blockHeader: Readonly<BlockHeader>,
    ) => Promise<FactoryState>;
  } = {};

  logDecoder: (log: Log) => any;

  public readonly factoryIface = new Interface(IntegralFactoryABI);

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    protected readonly factoryAddress: Address,
    protected readonly onPoolCreated: OnPoolCreatedCallback,
    logger: Logger,
    mapKey: string = '',
  ) {
    super(parentName, `${parentName} Factory`, dexHelper, logger, true, mapKey);

    this.addressesSubscribed = [factoryAddress];

    this.logDecoder = (log: Log) => this.factoryIface.parseLog(log);

    this.handlers['PairCreated'] = this.handlePairCreated.bind(this);
  }

  async generateState(blockNumber?: number | 'latest'): Promise<FactoryState> {
    const factory = new this.dexHelper.web3Provider.eth.Contract(
      IntegralFactoryABI as any,
      this.factoryAddress,
    );
    const poolCountResult = await factory.methods
      .allPairsLength()
      .call(undefined, blockNumber);
    const poolCount = Number(poolCountResult);
    const poolAddressCallDatas: MultiCallParams<string>[] = [
      ...Array(poolCount),
    ].map((_, i) => {
      return {
        target: this.factoryAddress,
        callData: factory.methods.allPairs(i).encodeABI(),
        decodeFunction: addressDecode,
      };
    });
    const poolAddresses =
      await this.dexHelper.multiWrapper.tryAggregate<string>(
        false,
        poolAddressCallDatas,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      );

    const poolIface = new Interface(IntegralPoolABI);
    const poolInfosCallDatas: MultiCallParams<string>[] = poolAddresses
      .map(poolAddress => {
        return [
          {
            target: poolAddress.returnData,
            callData: poolIface.encodeFunctionData('token0', []),
            decodeFunction: addressDecode,
          },
          {
            target: poolAddress.returnData,
            callData: poolIface.encodeFunctionData('token1', []),
            decodeFunction: addressDecode,
          },
        ];
      })
      .flat();
    const poolInfos = await this.dexHelper.multiWrapper.aggregate<string>(
      poolInfosCallDatas,
      blockNumber,
    );

    const state: FactoryState = { pools: {} };
    poolAddresses.forEach((poolAddress, i) => {
      const tokens: [Address, Address] = [
        poolInfos[i * 2].toLowerCase(),
        poolInfos[i * 2 + 1].toLowerCase(),
      ];
      state.pools[poolAddress.returnData.toLowerCase()] = {
        token0: tokens[0],
        token1: tokens[1],
      };
    });
    return state;
  }

  protected async processLog(
    state: FactoryState,
    log: Readonly<Log>,
    blockHeader: Readonly<BlockHeader>,
  ): Promise<FactoryState> {
    const event = this.logDecoder(log);
    if (event.name in this.handlers) {
      return await this.handlers[event.name](event, state, blockHeader);
    }

    return state;
  }

  async handlePairCreated(
    event: LogDescription,
    state: FactoryState,
    blockHeader: Readonly<BlockHeader>,
  ) {
    const tokens: [Address, Address] = [
      event.args.token0.toLowerCase(),
      event.args.token1.toLowerCase(),
    ];
    state.pools[event.args.pair.toLowerCase()] = {
      token0: tokens[0],
      token1: tokens[1],
    };
    await this.onPoolCreated(
      tokens[0],
      tokens[1],
      event.args.pair.toLowerCase(),
      blockHeader.number,
    );
    return state;
  }
}
