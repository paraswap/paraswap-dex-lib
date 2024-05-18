import { InfusionFinance } from '../infusion-finance';
import { InfusionFinancePair } from '../types';
import { Network } from '../../../constants';
import { IDexHelper } from '../../../dex-helper';
import { Interface } from '@ethersproject/abi';
import { getDexKeysWithNetwork } from '../../../utils';
import { InfusionFinanceConfig } from '../config';
import _ from 'lodash';

const EqualizerFactoryABI = [
  {
    inputs: [{ internalType: 'address', name: '_pair', type: 'address' }],
    name: 'getRealFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const equalizerFactoryIface = new Interface(EqualizerFactoryABI);

export class Equalizer extends InfusionFinance {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(InfusionFinanceConfig, ['Equalizer']));

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
      callData: equalizerFactoryIface.encodeFunctionData('getRealFee', [
        pair.exchange,
      ]),
    };
    const callDecoder = (values: any[]) =>
      parseInt(
        equalizerFactoryIface
          .decodeFunctionResult('getRealFee', values)[0]
          .toString(),
      );

    return {
      callEntry,
      callDecoder,
    };
  }
}
