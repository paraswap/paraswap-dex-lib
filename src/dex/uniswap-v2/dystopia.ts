import { UniswapV2 } from './uniswap-v2';
import { Network, NULL_ADDRESS } from '../../constants';
import { DexConfigMap, Token } from '../../types';
import { IDexHelper } from '../../dex-helper';
import { DexParams } from './types';
import { getDexKeysWithNetwork } from '../../utils';
import dystopiaFactoryABI from '../../abi/dystopia/DystFactory.json';

export const DystopiaConfig: DexConfigMap<DexParams> = {
  Dystopia: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/dystopia-exchange/dystopia',
      factoryAddress: '0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9',
      router: '0xbE75Dd16D029c6B32B7aD57A0FD9C1c20Dd2862e',
      initCode:
        '0x009bce6d7eb00d3d075e5bd9851068137f44bba159f1cde806a268e20baaf2e8',
      feeCode: 5,
      poolGasCost: 350 * 1000, // TODO check swap max gas cost
    },
  },
};

export class Dystopia extends UniswapV2 {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(DystopiaConfig);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      false,
      DystopiaConfig[dexKey][network].factoryAddress,
      DystopiaConfig[dexKey][network].subgraphURL,
      DystopiaConfig[dexKey][network].initCode,
      DystopiaConfig[dexKey][network].feeCode,
      DystopiaConfig[dexKey][network].poolGasCost,
    );

    this.factory = new dexHelper.web3Provider.eth.Contract(
      dystopiaFactoryABI as any,
      DystopiaConfig[dexKey][network].factoryAddress,
    );
  }

  async findPair(from: Token, to: Token) {
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}`;
    let pair = this.pairs[key];
    if (pair) return pair;
    // try to find non-stable pair first
    let exchange = await this.factory.methods
      .getPair(token0.address, token1.address, false)
      .call();

    // if non-stable is not found then try to get stable pair
    if (exchange === NULL_ADDRESS) {
      exchange = await this.factory.methods
        .getPair(token0.address, token1.address, true)
        .call();
    }

    if (exchange === NULL_ADDRESS) {
      pair = { token0, token1 };
    } else {
      pair = { token0, token1, exchange };
    }
    this.pairs[key] = pair;
    return pair;
  }
}
