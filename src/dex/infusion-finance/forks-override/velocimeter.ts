import { InfusionFinance } from '../infusion-finance';
import { InfusionFinancePair } from '../types';
import { Network } from '../../../constants';
import { IDexHelper } from '../../../dex-helper';
import { Interface } from '@ethersproject/abi';
import { getDexKeysWithNetwork } from '../../../utils';
import { InfusionFinanceConfig } from '../config';
import _ from 'lodash';

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

export class Velocimeter extends InfusionFinance {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(InfusionFinanceConfig, ['Velocimeter']));

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

  protected getFeesMultiCallData(pair: InfusionFinancePair) {
    const callEntry = {
      target: this.factoryAddress,
      callData: velocimeterFactoryIface.encodeFunctionData('getFee', [
        pair.exchange,
      ]),
    };
    const callDecoder = (values: any[]) =>
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
