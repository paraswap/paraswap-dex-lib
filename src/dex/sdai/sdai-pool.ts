import { BI_POWS } from '../../bigint-constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { Interface } from '@ethersproject/abi';

import type { IDexHelper } from '../../dex-helper';
import type { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import type { Address, BlockHeader, Log, Logger } from '../../types';
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

const calcChi = (state: SDaiPoolState, currentTimestamp?: number) => {
  currentTimestamp ||= Math.floor(Date.now() / 1000);
  if (!state.live) return RAY;

  const { dsr: dsr_, chi: chi_, rho: rho_ } = state;
  const now = BigInt(currentTimestamp);
  const rho = BigInt(rho_);
  const dsr = BigInt(dsr_);
  const chi = BigInt(chi_);

  return now > rho ? (rpow(dsr, now - rho) * chi) / RAY : chi;
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
    blockHeader: Readonly<BlockHeader>,
  ): AsyncOrSync<DeepReadonly<SDaiPoolState> | null> {
    const event = this.decoder(log);
    if (event.name === 'cage') {
      return {
        dsr: RAY.toString(),
        chi: RAY.toString(),
        rho: RAY.toString(),
        live: false,
      };
    }

    if (event.name === 'file' && event.args.what === 'dsr') {
      return {
        ...state,
        dsr: BigInt(event.args.data).toString(),
      };
    }

    if (event.name === 'drip') {
      return {
        ...state,
        rho: blockHeader.timestamp.toString(),
        chi: calcChi(state, +blockHeader.timestamp).toString(),
      };
    }

    return null;
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<SDaiPoolState>> {
    return {
      dsr: RAY.toString(),
      chi: RAY.toString(),
      rho: RAY.toString(),
      live: true,
    };
  }

  convertToSDai(daiAmount: bigint, blockNumber: number): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Unable to fetch state for SDAI');

    return (daiAmount * RAY) / calcChi(state);
  }

  convertToDai(sdaiAmount: bigint, blockNumber: number): bigint {
    const state = this.getState(blockNumber);
    if (!state) throw new Error('Unable to fetch state for SDAI');

    return (sdaiAmount * calcChi(state)) / RAY;
  }
}
