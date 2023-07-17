import { Address, Log } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { bigNumberify } from '../../../utils';
import { PoolState } from './curve-pool';
import { SETHPool } from './sETHpool';
import StableSwapSTETH from '../../../abi/curve-v1/StableSwapSTETH.json';
import { DeepReadonly } from 'ts-essentials';

const pool = 'frxETH';
export const address: Address =
  '0xa1f8a6807c402e4a15ef4eba36528a3fed24e577'.toLowerCase();
const tokenAddress: Address = '0xf43211935c781d5ca1a41d2041f397b8a7366c7a';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bigNumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0x5e8422345238f34275888049021821e8e08caa1f',
];
const trackCoins = true;
const ignoreLogsWithTopic0 = [
  // Submitted (index_topic_1 address sender, uint256 amount, address referral)
  '0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3332f3aa9a41722b5697231d1d1a',
];

export class FRXETHPool extends SETHPool {
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
      'FRXETHPool',
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

