import { IRouter } from './irouter';
import { MultiSwap } from './multiswap';
import { MegaSwap } from './megaswap';
import { SimpleSwap } from './simpleswap';
import { DirectSwap } from './directswap';
import { Adapters } from '../types';
import { DexAdapterService } from '../dex';

export class RouterService {
  hybridRouters = [MultiSwap, MegaSwap, SimpleSwap];
  hybridRouterMap: {
    [contractMethod: string]: IRouter<any>;
  };
  directSwapRouter: DirectSwap<any>;

  constructor(
    private dexAdapterService: DexAdapterService,
    private adapters: Adapters,
  ) {
    this.hybridRouterMap = this.hybridRouters.reduce<{
      [contractMethod: string]: IRouter<any>;
    }>((acc, Router) => {
      const router = new Router(this.dexAdapterService, this.adapters);
      acc[router.getContractMethodName().toLowerCase()] = router;
      return acc;
    }, {});

    this.directSwapRouter = new DirectSwap(dexAdapterService);
  }

  getRouterByContractMethod(contractMethod: string): IRouter<any> {
    const _contractMethod = contractMethod.toLowerCase();

    if (this.hybridRouterMap[_contractMethod])
      return this.hybridRouterMap[_contractMethod];

    if (this.dexAdapterService.isDirectFunctionName(_contractMethod)) {
      return this.directSwapRouter;
    }

    throw `couldn't recognize contractMethod ${contractMethod}`;
  }
}
