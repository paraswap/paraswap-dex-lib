import { PriceHandlerTypes } from '../types';
import { IPriceHandler } from './iprice-handler';
import { plainPriceHandler } from './plain-price-handler';

export const outputClassMappings: Record<
  PriceHandlerTypes,
  IPriceHandler<unknown>
> = {
  [PriceHandlerTypes.PLAIN]: plainPriceHandler,
};
