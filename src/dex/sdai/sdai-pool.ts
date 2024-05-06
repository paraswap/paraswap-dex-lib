import { BI_POWS } from '../../bigint-constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Interface } from '@ethersproject/abi';

import type { IDexHelper } from '../../dex-helper';
import type { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import type { Address, Log, Logger } from '../../types';
import type { SDaiPoolState } from './types';
import { getOnChainState } from './utils';
import { currentBigIntTimestampInS } from '../../utils';

const RAY = BI_POWS[27];
const ZERO = BigInt(0);
const TWO = BigInt(2);
const HALF = RAY / TWO;

const rpow = (x: bigint, n: bigint): bigint => {
  // REF: https://etherscan.io/address/0x83f20f44975d03b1b09e64809b757c47f942beea#code#L122
  let z = RAY;
  if (!x && !n) return z;
  if (!x) return ZERO;
  if (n % TWO > ZERO) {
    z = x;
  }

  for (n = n / TWO; n > ZERO; n /= TWO) {
    x = (x * x + HALF) / RAY;
    if (n % TWO > ZERO) continue;
    z = (z * x + HALF) / RAY;
  }

  return z;
};

export class SDaiPool extends StatefulEventSubscriber<SDaiPoolState> {
  decoder = (log: Log) => this.potInterface.parseLog(log);

  constructor(
    parentName: string,
    protected dexHelper: IDexHelper,
    private potAddress: Address,
    private potInterface: Interface,
    logger: Logger,
  ) {
    super(parentName, 'sdai', dexHelper, logger);
    this.addressesSubscribed = [potAddress];
  }

  protected processLog(
    state: DeepReadonly<SDaiPoolState>,
    log: Readonly<Log>,
  ): AsyncOrSync<DeepReadonly<SDaiPoolState> | null> {
    const event = this.decoder(log);
    // if (event.name === 'Reprice')
    //   return {
    //     dsr: BigInt(event.args.newSwETHToETHRate),
    //     rho: BigInt(event.args.newSwETHToETHRate),
    //     chi: BigInt(event.args.newSwETHToETHRate),
    //     timestamp: BigInt(0),
    //     // timestamp: BigInt(event.b);
    //   };

    return null;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<SDaiPoolState>> {
    const state = await getOnChainState(
      this.dexHelper.multiContract,
      this.potAddress,
      this.potInterface,
      blockNumber,
    );

    return state;
  }

  chi(blockNumber: number): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Cannot compute price');

    const { rho, chi, dsr } = state;

    const timestamp = currentBigIntTimestampInS();
    const multiplier = rpow(BigInt(dsr), timestamp - BigInt(rho));
    return timestamp > BigInt(rho)
      ? (multiplier * BigInt(chi)) / RAY
      : BigInt(chi);
  }

  convertToSDai(blockNumber: number, daiAmount: bigint): bigint {
    const chi = this.chi(blockNumber);
    return (daiAmount * RAY) / chi;
  }

  convertToDai(blockNumber: number, sdaiAmount: bigint): bigint {
    const chi = this.chi(blockNumber);
    return (sdaiAmount * chi) / RAY;
  }
}
