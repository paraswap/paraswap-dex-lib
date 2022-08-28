import { Solidly } from '../solidly';
import { SolidlyPair } from '../types';
import { Network } from '../../../constants';
import { IDexHelper } from '../../../dex-helper';
import { Interface } from '@ethersproject/abi';
import { SolidlyConfig } from '../config';
import { getDexKeysWithNetwork } from '../../../utils';
import _ from 'lodash';

const swapFeeFunctionName = 'swapFee';

const ConePairABI = [
  {
    inputs: [],
    name: swapFeeFunctionName,
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const conePairIface = new Interface(ConePairABI);

export class Cone extends Solidly {
  feeFactor = 1e4;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['Cone']));

  constructor(
    protected network: Network,
    protected dexKey: string,
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
      target: pair.exchange!,
      callData: conePairIface.encodeFunctionData(swapFeeFunctionName, []),
    };
    const callDecoder = (values: any[]) => {
      const fees = parseInt(
        conePairIface
          .decodeFunctionResult(swapFeeFunctionName, values)[0]
          .toString(),
      );
      if (!fees) return 0;

      // noinspection UnnecessaryLocalVariableJS
      const feeCode = Math.ceil(this.feeFactor / fees);
      return feeCode;
    };

    return {
      callEntry,
      callDecoder,
    };
  }
}
