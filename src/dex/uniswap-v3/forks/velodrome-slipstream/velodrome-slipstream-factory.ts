import {
  OnPoolCreatedCallback,
  UniswapV3Factory,
} from '../../uniswap-v3-factory';
import { LogDescription } from 'ethers/lib/utils';
import { Interface } from '@ethersproject/abi';
import FactoryABI from '../../../../abi/velodrome-slipstream/VelodromeSlipstreamFactory.abi.json';
import { IDexHelper } from '../../../../dex-helper';
import { Address, Logger } from '../../../../types';

export class VelodromeSlipstreamFactory extends UniswapV3Factory {
  public readonly factoryIface = new Interface(FactoryABI);

  constructor(
    readonly dexHelper: IDexHelper,
    parentName: string,
    protected readonly factoryAddress: Address,
    logger: Logger,
    protected readonly onPoolCreated: OnPoolCreatedCallback,
    mapKey: string = '',
  ) {
    super(dexHelper, parentName, factoryAddress, logger, onPoolCreated, mapKey);
    this.handlers['PoolCreated'] = this.handleNewPool.bind(this);
  }

  async handleNewPool(event: LogDescription) {
    this.logger.info(`handle new pool event ${JSON.stringify(event)}`);
    const token0 = event.args.token0.toLowerCase();
    const token1 = event.args.token1.toLowerCase();
    const tickSpacing = event.args.tickSpacing;

    await this.onPoolCreated({ token0, token1, fee: tickSpacing });
  }
}
