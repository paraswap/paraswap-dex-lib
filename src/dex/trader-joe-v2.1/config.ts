import { Address } from '@paraswap/core';
import { Network } from '../../constants';

export const TRADERJOE_V2_1_ROUTER_ADDRESS: { [network: number]: Address } = {
  [Network.AVALANCHE]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
  [Network.ARBITRUM]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
  [Network.BSC]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
  [Network.MAINNET]: '0x9A93a421b74F1c5755b83dD2C211614dC419C44b',
};
