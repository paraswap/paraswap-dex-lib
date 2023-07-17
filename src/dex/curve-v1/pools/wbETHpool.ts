import { Address, Log } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';
import { PoolState } from './curve-pool';
import { SETHPool } from './sETHpool';
import StableSwapSTETH from '../../../abi/curve-v1/StableSwapSTETH.json';
import { DeepReadonly } from 'ts-essentials';

const pool = 'wbETH';
export const address: Address =
  '0xbfab6fa95e0091ed66058ad493189d2cb29385e6'.toLowerCase();
const tokenAddress: Address = '0xbfab6fa95e0091ed66058ad493189d2cb29385e6';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xa2e3356610840701bdf5611a53974510ae27e2e1',
];
const trackCoins = true;
const ignoreLogsWithTopic0 = [
  // Submitted (index_topic_1 address sender, uint256 amount, address referral)
  '0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3332f3aa9a41722b5697231d1d1a',
];

export class WBETHPool extends SETHPool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      address,
      tokenAddress,
      trackCoins,
      StableSwapSTETH,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
      'WBETHPool',
    );
  }

  public processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    if (ignoreLogsWithTopic0.includes(log.topics[0].toLowerCase()))
      return state;
    return super.processLog(state, log);
  }
}


