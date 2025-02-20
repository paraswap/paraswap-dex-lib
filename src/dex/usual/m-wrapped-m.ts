import {
  Address,
  NumberAsString,
  DexExchangeParam,
  DexConfigMap,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams } from './types';
import { Interface, JsonFragment } from '@ethersproject/abi';
import { Usual } from './usual';
import { getDexKeysWithNetwork } from '../../utils';
import WRAPPED_M_ABI from '../../abi/m-token/WrappedM.abi.json';

const Config: DexConfigMap<DexParams> = {
  MWrappedM: {
    [Network.MAINNET]: {
      fromToken: {
        address: '0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b', // M
        decimals: 6,
      },
      toToken: {
        address: '0x437cc33344a0B27A429f795ff6B469C72698B291', // WrappedM
        decimals: 6,
      },
    },
  },
};

export class MWrappedM extends Usual {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(Config);

  wrappedMInterface: Interface;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(network, dexKey, dexHelper, Config[dexKey][network]);
    this.wrappedMInterface = new Interface(WRAPPED_M_ABI as JsonFragment[]);
  }

  async getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: {},
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    if (this.isFromToken(srcToken) && this.isToToken(destToken)) {
      const fn =
        srcToken.toLowerCase() === this.config.fromToken.address.toLowerCase()
          ? 'wrap(address, uint256)'
          : 'unwrap(address, uint256)';

      const exchangeData = this.wrappedMInterface.encodeFunctionData(fn, [
        recipient,
        srcAmount,
      ]);

      return {
        needWrapNative: false,
        dexFuncHasRecipient: true,
        exchangeData,
        targetExchange: this.config.toToken.address,
        returnAmountPos: undefined,
      };
    }

    throw new Error('LOGIC ERROR');
  }
}
