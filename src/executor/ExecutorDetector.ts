import { IDexHelper } from '../dex-helper';
import { Address, OptimalRate } from '@paraswap/core';
import { ExecutorBytecodeBuilder } from './ExecutorBytecodeBuilder';
import { Executor01BytecodeBuilder } from './Executor01BytecodeBuilder';
import { Executor02BytecodeBuilder } from './Executor02BytecodeBuilder';
import { Executors, RouteExecutionType } from './types';

export class ExecutorDetector {
  private executor01BytecodeBuilder: ExecutorBytecodeBuilder;
  private executor02BytecodeBuilder: ExecutorBytecodeBuilder;

  protected routeExecutionTypeToExecutorMap = {
    [RouteExecutionType.SINGLE_STEP]: Executors.TWO, // simpleSwap via Executor01
    [RouteExecutionType.HORIZONTAL_SEQUENCE]: Executors.ONE, // multiSwap via Executor01
    [RouteExecutionType.VERTICAL_BRANCH]: Executors.TWO, // simpleSwap with percentage on a path via Executor02
    [RouteExecutionType.VERTICAL_BRANCH_HORIZONTAL_SEQUENCE]: Executors.TWO, // multiSwap with pecentages on paths via Executor02
    // [RouteExecutionType.NESTED_VERTICAL_BRANCH_HORIZONTAL_SEQUENCE]: // megaSwap
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
      } else {
        return RouteExecutionType.VERTICAL_BRANCH_HORIZONTAL_SEQUENCE;
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
