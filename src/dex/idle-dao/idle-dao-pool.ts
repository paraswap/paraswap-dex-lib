import { AbiItem } from 'web3-utils';
import BigNumber from 'bignumber.js';
import { Contract } from 'web3-eth-contract';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import ERC20_ABI from '../../abi/erc20.json';
import CDO_ABI from '../../abi/idle-dao/idle-cdo.json';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, IdleToken, PoolsState } from './types';
import { IdleDaoPollingPool } from './idle-dao-pooling-pool';
import { getTokensByCdoAddress } from './tokens';
import { ObjWithUpdateInfo } from '../../lib/stateful-rpc-poller/types';
import { IdleDao } from './idle-dao';

type BlocksTransfers = Record<
  number,
  {
    underlyingAmount: BigNumber;
    idleAmount: BigNumber;
    processed: boolean;
  }
>;

export class IdleDaoEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => Promise<DeepReadonly<PoolState> | null>;
  } = {};

  logDecoder: (log: Log) => any;

  cdoContract: Contract;
  poolInterface: Interface;
  addressesSubscribed: string[];
  blocksTransfers: BlocksTransfers = {};

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    protected logger: Logger,
    protected idleToken: IdleToken,
    protected IdleDao: IdleDao,
  ) {
    // TODO: Add pool name
    super(parentName, idleToken.idleSymbol, dexHelper, logger);

    this.poolInterface = new Interface(ERC20_ABI);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.poolInterface.parseLog(log);

    this.addressesSubscribed = [idleToken.address.toLowerCase()];

    const cdoTokens = getTokensByCdoAddress(this.idleToken.cdoAddress);
    if (cdoTokens) {
      cdoTokens.forEach((idleToken: IdleToken) => {
        if (
          !this.addressesSubscribed.includes(
            idleToken.idleAddress.toLowerCase(),
          )
        ) {
          this.addressesSubscribed.push(idleToken.idleAddress.toLowerCase());
        }
      });
    }

    // this.logger.debug('addressesSubscribed', this.idleToken.idleAddress, this.addressesSubscribed)

    // Add handlers
    this.handlers['Transfer'] = this.handleCoinTransfer.bind(this);

    this.idleToken = idleToken;
    this.cdoContract = new dexHelper.web3Provider.eth.Contract(
      CDO_ABI as AbiItem[],
      this.idleToken.cdoAddress,
    );
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected async processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): Promise<DeepReadonly<PoolState> | null> {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        const result = await this.handlers[event.name](event, state, log);
        return result;
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    const tranchePrice = await this.cdoContract.methods['virtualPrice'](
      this.idleToken.idleAddress,
    ).call({}, blockNumber);
    return {
      tokenPrice: BigInt(tranchePrice),
    };
  }

  setBlockState(blockNumber: number, state: PoolState): void {
    this.logger.debug(
      'setBlockState',
      blockNumber,
      this.idleToken.idleAddress,
      state,
    );
    return this._setState(state, blockNumber);
  }

  async handleCoinTransfer(
    event: any,
    state: PoolState,
    log: Log,
  ): Promise<DeepReadonly<PoolState> | null> {
    const idleTokens = getTokensByCdoAddress(this.idleToken.cdoAddress);
    if (!idleTokens) return null;

    const pollingPool = new IdleDaoPollingPool(
      this.parentName,
      this.parentName,
      this.dexHelper,
      idleTokens,
      this.logger,
    );

    const blockNumber = log.blockNumber;
    let poolsState: ObjWithUpdateInfo<PoolsState> | null = null;

    if (log.address.toLowerCase() === this.idleToken.address.toLowerCase()) {
      if (
        event.args.dst.toLowerCase() ===
          this.idleToken.cdoAddress.toLowerCase() ||
        event.args.src.toLowerCase() === this.idleToken.cdoAddress.toLowerCase()
      ) {
        poolsState = await pollingPool.getAggregatedBlockData(blockNumber);
      }
    } else if (this.addressesSubscribed.includes(log.address.toLowerCase())) {
      poolsState = await pollingPool.getAggregatedBlockData(blockNumber);
    }

    // Update pools with the new state
    if (poolsState) {
      this.logger.debug(
        'Get pools state for CDO pools',
        blockNumber,
        this.idleToken.cdoAddress,
        poolsState,
      );
      Object.keys(poolsState.value as PoolsState).forEach(
        (idleAddress: string) => {
          const poolState = poolsState?.value?.[idleAddress];
          if (poolState) {
            this.IdleDao.setEventPoolStateBlock(
              idleAddress,
              poolsState!.blockNumber,
              poolState,
            );

            // Overwrite state
            if (idleAddress === this.idleToken.idleAddress) {
              state = poolState;
            }
          }
        },
      );
    }

    return state;
  }

  processBlockTransfer(blockNumber: number, state: PoolState): PoolState {
    if (
      !this.blocksTransfers[blockNumber] ||
      this.blocksTransfers[blockNumber].processed
    )
      return state;
    const idleAmount = this.blocksTransfers[blockNumber].idleAmount.div(1e18);
    const underlyingAmount = this.blocksTransfers[
      blockNumber
    ].underlyingAmount.div(`1e${this.idleToken.decimals}`);
    if (idleAmount.gt(0) && underlyingAmount.gt(0)) {
      const tokenPrice = BigInt(
        BigNumber.maximum(idleAmount, underlyingAmount)
          .div(BigNumber.minimum(idleAmount, underlyingAmount))
          .times(`1e${this.idleToken.decimals}`)
          .toFixed(0),
      );
      this.logger.debug(
        'tokenPrice',
        blockNumber,
        this.idleToken.idleSymbol,
        this.idleToken.decimals,
        idleAmount.toString(),
        underlyingAmount.toString(),
        tokenPrice.toString(),
      );
      this.blocksTransfers[blockNumber].processed = true;
      return {
        tokenPrice,
      };
    }
    return state;
  }

  async handleCoinTransfer_old(
    event: any,
    state: PoolState,
    log: Log,
  ): Promise<DeepReadonly<PoolState> | null> {
    // Handle underlying token transfer
    if (log.address.toLowerCase() === this.idleToken.address.toLowerCase()) {
      if (
        event.args.dst.toLowerCase() ===
          this.idleToken.cdoAddress.toLowerCase() ||
        event.args.src.toLowerCase() === this.idleToken.cdoAddress.toLowerCase()
      ) {
        if (!this.blocksTransfers[log.blockNumber]) {
          this.blocksTransfers[log.blockNumber] = {
            processed: false,
            idleAmount: BigNumber(0),
            underlyingAmount: BigNumber(0),
          };
        }
        this.logger.debug(
          'UnderlyingAmount',
          log.blockNumber,
          'event',
          event,
          'log',
          log,
          BigNumber(BigInt(event.args.wad).toString()).toFixed(),
        );
        this.blocksTransfers[log.blockNumber].underlyingAmount = BigNumber(
          BigInt(event.args.wad).toString(),
        );
      }
    }
    // Handle idle token transfer
    else if (
      log.address.toLowerCase() === this.idleToken.idleAddress.toLowerCase()
    ) {
      this.logger.debug(
        'IdleToken Transfer',
        log.blockNumber,
        'event',
        event,
        'log',
        log,
      );
      if (
        event.args.src.toLowerCase() ===
          '0x0000000000000000000000000000000000000000' ||
        event.args.dst.toLowerCase() ===
          '0x0000000000000000000000000000000000000000'
      ) {
        if (!this.blocksTransfers[log.blockNumber]) {
          this.blocksTransfers[log.blockNumber] = {
            processed: false,
            idleAmount: BigNumber(0),
            underlyingAmount: BigNumber(0),
          };
        }
        this.logger.debug(
          'IdleAmount',
          log.blockNumber,
          'event',
          event,
          'log',
          log,
          BigNumber(BigInt(event.args.wad).toString()).toFixed(),
        );
        this.blocksTransfers[log.blockNumber].idleAmount = BigNumber(
          BigInt(event.args.wad).toString(),
        );
      }
    }

    return this.processBlockTransfer(log.blockNumber, state);
  }
}
