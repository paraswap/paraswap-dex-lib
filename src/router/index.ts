import { RouterMap, IRouter } from './irouter';
import { DexMap, IDex } from '../dex/idex';
import { MultiSwap } from './multiswap';
import { MegaSwap } from './megaswap';
import { SimpleSwap } from './simpleswap';
import { DirectSwap } from './directswap';
import { Adapters } from '../types';
import { SwapSide } from '../constants';

// new (dexMap: DexMap, adapters: Adapters) => IRouter<any>
export function getRouterMap(dexMap: DexMap, adapters: Adapters): RouterMap {
  const hybridRouters = [MultiSwap, MegaSwap, SimpleSwap];
  const hybridRouterMap = hybridRouters.reduce(
    (
      acc: RouterMap,
      r: new (dexMap: DexMap, adapters: Adapters) => IRouter<any>,
    ) => {
      const rObj = new r(dexMap, adapters);
      acc[rObj.getContractMethodName().toLowerCase()] = rObj;
      return acc;
    },
    {},
  );

  const directRouteMap = Object.values(dexMap).reduce(
    (acc: RouterMap, dex: IDex<any, any>) => {
      const directFuctionName =
        dex.getDirectFuctionName && dex.getDirectFuctionName();
      if (directFuctionName) {
        if (directFuctionName.sell) {
          acc[directFuctionName.sell.toLowerCase()] = new DirectSwap(
            dex,
            SwapSide.SELL,
          );
        }
        if (directFuctionName.buy) {
          acc[directFuctionName.buy.toLowerCase()] = new DirectSwap(
            dex,
            SwapSide.BUY,
          );
        }
      }
      return acc;
    },
    {},
  );
  return { ...hybridRouterMap, ...directRouteMap };
}
