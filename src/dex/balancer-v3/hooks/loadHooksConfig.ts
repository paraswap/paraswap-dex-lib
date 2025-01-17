import { BalancerV3Config } from './../config';
import { HooksTypeMap } from './balancer-hook-event-subscriber';

export function loadHooksConfig(network: number): HooksTypeMap {
  const hooks = BalancerV3Config.BalancerV3[network].hooks;
  // Create the inverted dictionary efficiently
  return Object.entries(hooks ?? {}).reduce((acc, [hookType, addresses]) => {
    addresses.forEach(address => {
      acc[address] = hookType;
    });
    return acc;
  }, {} as HooksTypeMap);
}
