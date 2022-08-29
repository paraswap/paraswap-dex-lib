import { bignumberify, getDexKeysWithNetwork } from '../../../../utils';
import { CurveV1 } from '../../curve-v1';
import { CurvePool } from '../../pools/curve-pool';
import StableSwapSUSD from '../../../../abi/curve/StableSwapSUSD.json';
import { Network } from '../../../../constants';
import { IDexHelper } from '../../../../dex-helper';
import { Adapters, SwerveConfig } from './config';
import { SUSDPool } from '../../pools/sUSDpool';

const pool = 'swerve';
const swervePoolAddress =
  '0x329239599afB305DA0A2eC69c58F8a6697F9F88d'.toLowerCase();

const tokenAddress = '0x77C6E4a580c0dCE4E5c7a17d0bc077188a83A059';
const N_COINS: number = 4;
const PRECISION_MUL = ['1', '1000000000000', '1000000000000', '1'].map(
  bignumberify,
);
const USE_LENDING = [false, false, false, false];
const COINS = [
  '0x6b175474e89094c44da98b954eedeac495271d0f',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0xdac17f958d2ee523a2206206994597c13d831ec7',
  '0x0000000000085d4780B73119b644AE5ecd22b376',
];
const trackCoins = false;

export class SwervePool extends SUSDPool {
  constructor(parentName: string, dexHelper: IDexHelper) {
    super(
      parentName,
      dexHelper,
      pool,
      swervePoolAddress,
      tokenAddress,
      trackCoins,
      StableSwapSUSD,
      N_COINS,
      PRECISION_MUL,
      USE_LENDING,
      COINS,
    );
  }
}

export class Swerve extends CurveV1 {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SwerveConfig);

  constructor(
    dexHelper: IDexHelper,
    dexKey: string,
    dexConfig = SwerveConfig[dexKey][dexHelper.network],
    adapters = Adapters[dexHelper.network],
  ) {
    super(dexHelper, dexKey, dexConfig, adapters);
  }

  getEventPoolInstance(poolAddress: string): CurvePool | null {
    switch (poolAddress.toLowerCase()) {
      case swervePoolAddress:
        return new SwervePool(this.dexKey, this.dexHelper);
      default:
        return null;
    }
  }
}
