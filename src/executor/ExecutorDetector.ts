import { IDexHelper } from '../dex-helper';
import { Address, OptimalRate } from '@paraswap/core';
import { ExecutorBytecodeBuilder } from './ExecutorBytecodeBuilder';
import { Executor01BytecodeBuilder } from './Executor01BytecodeBuilder';
import { Executor02BytecodeBuilder } from './Executor02BytecodeBuilder';

export enum Executors {
  ONE = 'Executor01',
  TWO = 'Executor02',
}

enum RouteExecutionType {
  SINGLE_STEP = 0, // simpleSwap with 100% on a path and single DEX
  HORIZONTAL_SEQUENCE = 1, // multiSwap with 100% on each path
  VERTICAL_BRANCH = 3, // simpleSwap with N DEXs on a path
  // VERTICAL_BRANCH_HORIZONTAL_SEQUENCE = 4, // megaSwap
  // NESTED_VERTICAL_BRANCH_HORIZONTAL_SEQUENCE = 5, // megaSwap
}

export class ExecutorDetector {
  private executor01BytecodeBuilder: ExecutorBytecodeBuilder;
  private executor02BytecodeBuilder: ExecutorBytecodeBuilder;

  protected routeExecutionTypeToExecutorMap = {
    [RouteExecutionType.SINGLE_STEP]: Executors.ONE,
    [RouteExecutionType.HORIZONTAL_SEQUENCE]: Executors.ONE,
    [RouteExecutionType.VERTICAL_BRANCH]: Executors.TWO,
    // [RouteExecutionType.VERTICAL_BRANCH_HORIZONTAL_SEQUENCE]: Executors.TWO,
    // [RouteExecutionType.NESTED_VERTICAL_BRANCH_HORIZONTAL_SEQUENCE]:
    //   Executors.TWO,
  };

  constructor(protected dexHelper: IDexHelper) {
    this.executor01BytecodeBuilder = new Executor01BytecodeBuilder(
      this.dexHelper,
    );
    this.executor02BytecodeBuilder = new Executor02BytecodeBuilder(
      this.dexHelper,
    );
  }
  /**
   * The method supports only simpleSwap and multiSwap with 100% token percent on each path (Executor01)
   * @param priceRoute
   */
  protected getRouteExecutionType(priceRoute: OptimalRate): RouteExecutionType {
    if (
      priceRoute.bestRoute.length === 1 &&
      priceRoute.bestRoute[0].percent === 100 &&
      priceRoute.bestRoute[0].swaps.length === 1 &&
      priceRoute.bestRoute[0].swaps[0].swapExchanges.length > 1
    ) {
      return RouteExecutionType.VERTICAL_BRANCH;
    } else if (
      priceRoute.bestRoute.length === 1 &&
      priceRoute.bestRoute[0].percent === 100 &&
      priceRoute.bestRoute[0].swaps.length === 1
    ) {
      return RouteExecutionType.SINGLE_STEP;
    } else if (
      priceRoute.bestRoute.length === 1 &&
      priceRoute.bestRoute[0].percent === 100 &&
      priceRoute.bestRoute[0].swaps.length > 1
    ) {
      let has100PercentOnEachPath = true;
      priceRoute.bestRoute[0].swaps.map(swap => {
        swap.swapExchanges.map(se => {
          if (se.percent !== 100) {
            has100PercentOnEachPath = false;
          }
        });
      });

      if (has100PercentOnEachPath) {
        return RouteExecutionType.HORIZONTAL_SEQUENCE;
      }
    }

    throw new Error('Route type is not supported yet');
  }

  getExecutorByPriceRoute(priceRoute: OptimalRate): Executors {
    const routeExecutionType = this.getRouteExecutionType(priceRoute);

    const executorName =
      this.routeExecutionTypeToExecutorMap[routeExecutionType];

    if (executorName) {
      return executorName;
    }

    throw new Error(`${executorName} is not implemented`);
  }

  getAddress(executorName: Executors): Address {
    if (!Object.values(Executors).includes(executorName)) {
      throw new Error(`${executorName} is not supported`);
    }

    return this.dexHelper.config.data.executorsAddresses![executorName];
  }

  getBytecodeBuilder(executorName: Executors): ExecutorBytecodeBuilder {
    switch (executorName) {
      case Executors.ONE:
        return this.executor01BytecodeBuilder;
      case Executors.TWO:
        return this.executor02BytecodeBuilder;
      default:
        throw new Error(`${executorName} is not supported`);
    }
  }
}
