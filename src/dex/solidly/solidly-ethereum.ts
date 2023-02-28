import { Solidly } from './solidly';
import { SolidlyPair } from './types';
import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Interface } from '@ethersproject/abi';
import { SolidlyConfig } from './config';
import { getDexKeysWithNetwork } from '../../utils';
import _ from 'lodash';

const SolidlyBaseV2FactoryABI = [
  'function poolFees(address pool) external view returns (uint256)',
];

const solidlyEthereumPairInterface = new Interface(SolidlyBaseV2FactoryABI);

const poolFeeMethodName = 'poolFees';

export class SolidlyEthereum extends Solidly {
  feeFactor = 1e6;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SolidlyConfig, ['SolidlyEthereum']));
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

  private callDecoder(values: any[]) {
    const fees = parseInt(
      solidlyEthereumPairInterface
        .decodeFunctionResult(poolFeeMethodName, values)[0]
        .toString(),
    );
    if (!fees) return 0;

    return fees;
  }

  protected getFeesMultiCallData(pair: SolidlyPair) {
    const callEntry = {
      target: this.factoryAddress!,
      callData: solidlyEthereumPairInterface.encodeFunctionData(
        poolFeeMethodName,
        [pair.exchange],
      ),
    };

    return {
      callEntry,
      callDecoder: this.callDecoder.bind(this),
    };
  }
}
