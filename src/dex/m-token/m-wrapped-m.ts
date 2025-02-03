import { Network } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MToken } from './m-token';
import type { DexParams } from './types';
import type {
  Address,
  DexConfigMap,
  DexExchangeParam,
  NumberAsString,
  Token,
} from '../../types';
import { Interface } from '@ethersproject/abi';
import WRAPPED_M_ABI from '../../abi/m-token/WrappedM.abi.json';

export const MWrappedMConfig: DexConfigMap<DexParams> = {
  MWrappedM: {
    [Network.MAINNET]: {
      MTOKEN: {
        // M Token
        address: '0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b',
        decimals: 6,
      },
      WRAPPEDM: {
        // WrappedM Token
        address: '0x437cc33344a0B27A429f795ff6B469C72698B291',
        decimals: 6,
      },
    },
  },
};

export class MWrappedM extends MToken {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(MWrappedMConfig);

  wrappedMInterface: Interface;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    const config = MWrappedMConfig[dexKey][network];
    super(network, dexKey, dexHelper, config);

    this.wrappedMInterface = new Interface(WRAPPED_M_ABI);
  }

  async getDexParam(
    from: Address,
    to: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
  ): Promise<DexExchangeParam> {
    if (
      !this.ensureOrigin({
        from: { address: from } as Token,
        to: { address: to } as Token,
      })
    ) {
      throw new Error('Unexpected token addresses');
    }

    // TODO: Enable bi-directional swap?
    const exchangeData = this.wrappedMInterface.encodeFunctionData(
      'wrap(address, uint256)',
      [recipient, srcAmount],
    );

    return {
      needWrapNative: false,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange: this.config.WRAPPEDM.address,
      returnAmountPos: undefined,
    };
  }
}
