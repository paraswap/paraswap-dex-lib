import { DeepReadonly } from 'ts-essentials';
import {
  PartialEventSubscriber,
  ComposedEventSubscriber,
} from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PlatypusPoolStateCommon } from './types';
import { Token } from '../../types';
import { BI_POWS } from '../../bigint-constants';

export const ETH_UNIT = BI_POWS[18];
export const WAD = BI_POWS[18];
export const RAY = BI_POWS[27];

export function wmul(x: bigint, y: bigint): bigint {
  return (x * y + WAD / 2n) / WAD;
}

export function wdiv(x: bigint, y: bigint): bigint {
  return (x * WAD + y / 2n) / y;
}

export function rmul(x: bigint, y: bigint): bigint {
  return (x * y + RAY / 2n) / RAY;
}

export function rpow(x: bigint, n: bigint): bigint {
  let z = n % 2n !== 0n ? x : RAY;

  for (n /= 2n; n !== 0n; n /= 2n) {
    x = rmul(x, x);

    if (n % 2n !== 0n) {
      z = rmul(z, x);
    }
  }

  return z;
}

function slippageFunc(
  k: bigint,
  n: bigint,
  c1: bigint,
  xThreshold: bigint,
  x: bigint,
): bigint {
  if (x < xThreshold) {
    return c1 - x;
  } else {
    return wdiv(k, (rpow((x * RAY) / WAD, n) * WAD) / RAY);
  }
}

function calcSlippage(
  k: bigint,
  n: bigint,
  c1: bigint,
  xThreshold: bigint,
  cash: bigint,
  liability: bigint,
  cashChange: bigint,
  addCash: boolean,
): bigint {
  const covBefore = wdiv(cash, liability);
  let covAfter: bigint;
  if (addCash) {
    covAfter = wdiv(cash + cashChange, liability);
  } else {
    covAfter = wdiv(cash - cashChange, liability);
  }
  if (covBefore === covAfter) {
    return 0n;
  }

  const slippageBefore = slippageFunc(k, n, c1, xThreshold, covBefore);
  const slippageAfter = slippageFunc(k, n, c1, xThreshold, covAfter);

  if (covBefore > covAfter) {
    return wdiv(slippageAfter - slippageBefore, covBefore - covAfter);
  } else {
    return wdiv(slippageBefore - slippageAfter, covAfter - covBefore);
  }
}

function calcSwappingSlippage(si: bigint, sj: bigint): bigint {
  return WAD + si - sj;
}

function calcHaircut(amount: bigint, rate: bigint): bigint {
  return wmul(amount, rate);
}

export function calcPrice(
  srcToken: Token,
  destToken: Token,
  fromAmount: bigint,
  idealToAmount: bigint,
  state: PlatypusPoolStateCommon,
): bigint {
  if (state.asset[destToken.address].cash < idealToAmount) return 0n;
  const slippageFrom = calcSlippage(
    state.params.slippageParamK,
    state.params.slippageParamN,
    state.params.c1,
    state.params.xThreshold,
    state.asset[srcToken.address].cash,
    state.asset[srcToken.address].liability,
    fromAmount,
    true,
  );
  const slippageTo = calcSlippage(
    state.params.slippageParamK,
    state.params.slippageParamN,
    state.params.c1,
    state.params.xThreshold,
    state.asset[destToken.address].cash,
    state.asset[destToken.address].liability,
    idealToAmount,
    false,
  );
  const swappingSlippage = calcSwappingSlippage(slippageFrom, slippageTo);
  const toAmount = wmul(idealToAmount, swappingSlippage);
  const haircut = calcHaircut(toAmount, state.params.haircutRate);
  return toAmount - haircut;
}

export abstract class PlatypusPoolBase<
  State extends PlatypusPoolStateCommon,
> extends ComposedEventSubscriber<State> {
  constructor(
    protected readonly dexKey: string,
    protected readonly network: number,
    name: string,
    dexHelper: IDexHelper,
    parts: PartialEventSubscriber<State, any>[],
    blankState: DeepReadonly<State>,
  ) {
    super(
      `${dexKey} ${name}`,
      dexHelper.getLogger(`${dexKey}-${network} ${name}`),
      dexHelper,
      parts,
      blankState,
    );
  }

  public abstract computePrices(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    state: State,
  ): bigint[];
}
