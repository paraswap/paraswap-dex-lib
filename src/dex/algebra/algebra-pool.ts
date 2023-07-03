import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Address, Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';
import { ethers } from 'ethers';
import { Contract } from 'web3-eth-contract';
import AlgebraABI from '../../abi/algebra/AlgebraPool.abi.json';

export class AlgebraEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  private _poolAddress?: Address;
  readonly token0: Address;
  readonly token1: Address;

  public readonly poolIface = new Interface(AlgebraABI);

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    readonly stateMultiContract: Contract,
    readonly erc20Interface: Interface,
    protected readonly factoryAddress: Address,
    token0: Address,
    token1: Address,
    logger: Logger,
    mapKey: string = '',
    readonly poolInitCodeHash: string,
    readonly poolDeployer: string,
  ) {
    super(parentName, `${token0}_${token1}`, dexHelper, logger, true, mapKey);
    this.token0 = token0.toLowerCase();
    this.token1 = token1.toLowerCase();

    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = new Array<Address>(1);
  }

  get poolAddress() {
    if (this._poolAddress === undefined) {
      this._poolAddress = this._computePoolAddress(this.token0, this.token1);
    }
    return this._poolAddress;
  }

  set poolAddress(address: Address) {
    this._poolAddress = address.toLowerCase();
  }

  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    // TODO: complete me!
    return {} as any;
  }

  private _computePoolAddress(token0: Address, token1: Address): Address {
    // https://github.com/Uniswap/v3-periphery/blob/main/contracts/libraries/PoolAddress.sol
    if (token0 > token1) [token0, token1] = [token1, token0];

    const encodedKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'address'],
        [token0, token1],
      ),
    );

    return ethers.utils.getCreate2Address(
      this.poolDeployer,
      encodedKey,
      this.poolInitCodeHash,
    );
  }
}
