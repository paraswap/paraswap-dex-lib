import { IRouter } from './irouter';
import { MultiSwap } from './multiswap';
import { MegaSwap } from './megaswap';
import { Buy } from './buy';
import { SimpleSwap, SimpleBuy } from './simpleswap';
import { SimpleBuyNFT } from './simpleswapnft';
import { DirectSwap } from './directswap';
import { Adapters } from '../types';
import { DexAdapterService } from '../dex';
import { SwapSide } from '../constants';

export class RouterService {
  hybridRouters = [
    MultiSwap,
    MegaSwap,
    SimpleSwap,
    SimpleBuy,
    SimpleBuyNFT,
    Buy,
  ];
  hybridRouterMap: {
    [contractMethod: string]: IRouter<any>;
  };
  directSwapRouter: DirectSwap<any>;

  constructor(private dexAdapterService: DexAdapterService) {
    this.hybridRouterMap = this.hybridRouters.reduce<{
      [contractMethod: string]: IRouter<any>;
    }>((acc, Router) => {
      const router = new Router(this.dexAdapterService);
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

    throw new Error(`couldn't recognize contractMethod ${contractMethod}`);
  }
}
