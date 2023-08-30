import { Solidly } from '../solidly';
import { Network } from '../../../constants';
import { getDexKeysWithNetwork } from '../../../utils';
import { SolidlyConfig } from '../config';
import _ from 'lodash';
import { Address, PoolLiquidity } from '../../../types';
import { SolidlyPair } from '../types';
import { Interface } from '@ethersproject/abi';
import { IDexHelper } from '../../../dex-helper';

const VelodromeV2FactoryABI = [
  {
    inputs: [
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'bool', name: '_stable', type: 'bool' },
    ],
    name: 'getFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const velodromeV2FactoryIface = new Interface(VelodromeV2FactoryABI);

export class VelodromeV2 extends Solidly {

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['VelodromeV2']));

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      true, // dynamic fees
    );
  }

  protected getFeesMultiCallData(pair: SolidlyPair) {
    const callEntry = {
      target: this.factoryAddress,
      callData: velodromeV2FactoryIface.encodeFunctionData('getFee', [pair.exchange, pair.stable]),
    };
    const callDecoder = (values: any[]) =>
      parseInt(
        velodromeV2FactoryIface
          .decodeFunctionResult('getFee', values)[0]
          .toString(),
      );

    return {
      callEntry,
      callDecoder,
    };
  }

  // there is no subgraph for VelodromeV2
  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }
}
