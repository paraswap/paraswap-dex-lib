import { Address, Log } from '../../../types';
import { SETHPool } from './sETHpool';
import StableSwapSTETH from '../../../abi/curve/StableSwapSTETH.json';
import { PoolState } from './curve-pool';
import { DeepReadonly } from 'ts-essentials';
import { IDexHelper } from '../../../dex-helper';
import { bignumberify } from '../../../utils';

const pool = 'stETH';
export const address: Address =
  '0xDC24316b9AE028F1497c275EB9192a3Ea0f67022'.toLowerCase();
const tokenAddress: Address = '0x06325440D014e39736583c165C2963BA99fAf14E';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bignumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
];
const trackCoins = true;
const ignoreLogsWithTopic0 = [
  // Submitted (index_topic_1 address sender, uint256 amount, address referral)
  '0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3332f3aa9a41722b5697231d1d1a',
];

export class STETHPool extends SETHPool {
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
      'STETHPool',
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
