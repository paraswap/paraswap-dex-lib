import { InfusionFinance } from './infusion-finance';
import { InfusionFinancePair } from './types';
import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Interface } from '@ethersproject/abi';
import { InfusionFinanceConfig } from './config';
import { getDexKeysWithNetwork } from '../../utils';
import _ from 'lodash';

const InfusionFinanceBaseV2FactoryABI = [
  'function poolFees(address pool) external view returns (uint256)',
];

const infusionFinanceEthereumPairInterface = new Interface(
  InfusionFinanceBaseV2FactoryABI,
);

const poolFeeMethodName = 'poolFees';

export class InfusionFinanceEthereum extends InfusionFinance {
  feeFactor = 1e6;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(InfusionFinanceConfig, ['SolidlyV2']));
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
      infusionFinanceEthereumPairInterface
        .decodeFunctionResult(poolFeeMethodName, values)[0]
        .toString(),
    );
    if (!fees) return 0;

    return fees;
  }

  protected getFeesMultiCallData(pair: InfusionFinancePair) {
    const callEntry = {
      target: this.factoryAddress!,
      callData: infusionFinanceEthereumPairInterface.encodeFunctionData(
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
