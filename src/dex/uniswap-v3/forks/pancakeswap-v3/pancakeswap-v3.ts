import { UniswapV3 } from '../../uniswap-v3';
import { Network } from '../../../../constants';
import { IDexHelper } from '../../../../dex-helper';
import { Interface } from '@ethersproject/abi';
import PancakeswapV3RouterABI from '../../../../abi/uniswap-v3/pancakeswap-v3/PancakeswapV3Router.abi.json';
import PancakeswapV3QuoterV2ABI from '../../../../abi/uniswap-v3/pancakeswap-v3/PancakeswapV3QuoterV2.abi.json';
import { getDexKeysWithNetwork } from '../../../../utils';
import _ from 'lodash';
import { UniswapV3Config } from '../../config';

export class PancakeswapV3 extends UniswapV3 {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(UniswapV3Config, ['PancakeswapV3']));
  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      undefined,
      new Interface(PancakeswapV3RouterABI),
      new Interface(PancakeswapV3QuoterV2ABI),
    );
  }
}
