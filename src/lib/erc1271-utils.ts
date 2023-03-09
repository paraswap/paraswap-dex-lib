import Web3 from 'web3';
import type { Contract, ContractSendMethod } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import ERC1271ABI from '../abi/ERC1271.abi.json';

export interface ERC1271Contract extends Contract {
  methods: {
    isValidSignature(
      message: string,
      signature: string,
    ): Omit<ContractSendMethod, 'call'> & {
      call: (
        ...params: Parameters<ContractSendMethod['call']>
      ) => Promise<boolean>;
    };
  };
}

export const createERC1271Contract = (
  web3: Web3,
  addr: string,
): ERC1271Contract => {
  return new web3.eth.Contract(ERC1271ABI as AbiItem[], addr);
};
