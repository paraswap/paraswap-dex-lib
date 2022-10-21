import { ImplementationNames } from '../types';
import { PriceHandler } from './price-handler';

export const implementationToPricing: Record<
  ImplementationNames,
  PriceHandler
> = {
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: FactoryPlain,
};
