import { InfusionFinance } from '../infusion-finance';
import { InfusionFinancePair } from '../types';
import { Network } from '../../../constants';
import { IDexHelper } from '../../../dex-helper';
import { Interface } from '@ethersproject/abi';
import { getDexKeysWithNetwork } from '../../../utils';
import { InfusionFinanceConfig } from '../config';
import _ from 'lodash';

const VelodromeFactoryABI = [
  {
    inputs: [{ internalType: 'bool', name: '_stable', type: 'bool' }],
    name: 'getFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const velodromeFactoryIface = new Interface(VelodromeFactoryABI);

export class Infusion extends InfusionFinance {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(InfusionFinanceConfig, ['InfusionFinance']));

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
      callData: velodromeFactoryIface.encodeFunctionData('getFee', [
        pair.stable,
      ]),
    };
    const callDecoder = (values: any[]) =>
      parseInt(
        velodromeFactoryIface
          .decodeFunctionResult('getFee', values)[0]
          .toString(),
      );

    return {
      callEntry,
      callDecoder,
    };
  }
}
