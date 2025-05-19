import { Solidly } from '../solidly';
import { SolidlyPair } from '../types';
import { Network } from '../../../constants';
import { IDexHelper } from '../../../dex-helper';
import { getDexKeysWithNetwork } from '../../../utils';
import { SolidlyConfig } from '../config';
import _ from 'lodash';
import { BytesLike, Interface } from 'ethers';

const velocimeterFactoryABI = [
  {
    inputs: [{ internalType: '_pair', name: '_stable', type: 'address' }],
    name: 'getFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const velocimeterFactoryIface = new Interface(velocimeterFactoryABI);

export class Velocimeter extends Solidly {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['Velocimeter']));

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
      callData: velocimeterFactoryIface.encodeFunctionData('getFee', [
        pair.exchange,
      ]),
    };
    const callDecoder = (values: BytesLike) =>
      parseInt(
        velocimeterFactoryIface
          .decodeFunctionResult('getFee', values)[0]
          .toString(),
      );

    return {
      callEntry,
      callDecoder,
    };
  }
}
