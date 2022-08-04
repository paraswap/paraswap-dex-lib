import { Interface } from '@ethersproject/abi';
import ERC20ABI from '../abi/erc20.json';

export const erc20Iface = new Interface(ERC20ABI);
