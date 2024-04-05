import { VelodromeV2 } from './velodromeV2';
import { Network, NULL_ADDRESS } from '../../../constants';
import { getDexKeysWithNetwork } from '../../../utils';
import _ from 'lodash';
import { SolidlyConfig } from '../config';
import { Token } from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import AerodromeFactoryABI from '../../../abi/aerodrome/aerodrome-pool-factory.json';

export class Aerodrome extends VelodromeV2 {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['Aerodrome']));

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(network, dexKey, dexHelper);

    this.factory = new dexHelper.web3Provider.eth.Contract(
      AerodromeFactoryABI as any,
      SolidlyConfig[dexKey][network].factoryAddress,
    );
  }

  async findSolidlyPair(from: Token, to: Token, stable: boolean) {
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const typePostfix = this.poolPostfix(stable);
    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}-${typePostfix}`;
    let pair = this.pairs[key];
    if (pair) return pair;

    let exchange = await this.factory.methods
      // Solidly has additional boolean parameter "StablePool"
      // At first we look for uniswap-like volatile pool
      .getPool(token0.address, token1.address, stable)
      .call();

    if (exchange === NULL_ADDRESS) {
      pair = { token0, token1, stable };
    } else {
      pair = { token0, token1, exchange, stable };
    }
    this.pairs[key] = pair;
    return pair;
  }
}
