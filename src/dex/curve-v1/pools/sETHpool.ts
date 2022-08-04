import { Address, Log } from '../../../types';
import { ThreePool } from './3pool';
import StableSwapSETH from '../../../abi/curve/StableSwapSETH.json';
import { PoolState } from './curve-pool';
import { DeepReadonly } from 'ts-essentials';
import { IDexHelper } from '../../../dex-helper';
import { bignumberify } from '../../../utils';

const pool = 'sETH';
export const address: Address =
  '0xc5424B857f758E906013F3555Dad202e4bdB4567'.toLowerCase();
const tokenAddress: Address = '0xA3D87FffcE63B53E0d54fAa1cc983B7eB0b74A9c';
const N_COINS: number = 2;
const PRECISION_MUL = ['1', '1'].map(bignumberify);
const USE_LENDING = [false, false];
const COINS = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb',
];
const trackCoins = true;

export class SETHPool extends ThreePool {
  lastTransferedCoinBlock: number;
  constructor(
    parentName: string,
    dexHelper: IDexHelper,
    _pool = pool,
    _address = address,
    _tokenAddress = tokenAddress,
    _trackCoins = trackCoins,
    _abi: any = StableSwapSETH,
    _N_COINS = N_COINS,
    _PRECISION_MUL = PRECISION_MUL,
    _USE_LENDING = USE_LENDING,
    _COINS = COINS,
    _loggerPrefix = 'SETHPool',
  ) {
    super(
      parentName,
      dexHelper,
      _pool,
      _address,
      _tokenAddress,
      _trackCoins,
      _abi,
      _N_COINS,
      _PRECISION_MUL,
      _USE_LENDING,
      _COINS,
      _loggerPrefix,
    );
    this.lastTransferedCoinBlock = 0;
  }

  public processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    // This is hack as this pool uses standard ETH which doesn't
    // Release any events and as there are only 2 pools if there
    // was no event from sETH then the lastTransferedCoin should
    // be ETH. This will fail if the log our not processes sequentially
    if (log.blockNumber != this.lastTransferedCoinBlock) {
      this.lastTransferedCoinBlock = log.blockNumber;
      this.lastTransferedCoin = COINS[0].toLowerCase();
    }
    return super.processLog(state, log);
  }
}
