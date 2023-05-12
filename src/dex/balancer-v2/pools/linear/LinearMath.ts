import { MathSol } from '../../balancer-v2-math';

/*
Note when comparing vs smart contract:
Math.divDown === MathSol.divDown (i.e. no fixed point)
uint256.divDown === MathSol.divDownFixed (i.e. has fixed point)
Similar for mul
*/

type Params = {
  rate: bigint;
  fee: bigint;
  lowerTarget: bigint;
  upperTarget: bigint;
};

export function _calcBptOutPerMainIn(
  mainIn: bigint,
  mainBalance: bigint,
  wrappedBalance: bigint,
  bptSupply: bigint,
  params: Params,
): bigint {
  // Amount out, so we round down overall.

  if (bptSupply == 0n) {
    return _toNominal(mainIn, params);
  }

  const previousNominalMain = _toNominal(mainBalance, params);
  const afterNominalMain = _toNominal(mainBalance + mainIn, params);
  const deltaNominalMain = afterNominalMain - previousNominalMain;
  const invariant = _calcInvariantUp(
    previousNominalMain,
    wrappedBalance,
    params,
  );
  return MathSol.divDown(MathSol.mul(bptSupply, deltaNominalMain), invariant);
}

export function _calcBptInPerMainOut(
  mainOut: bigint,
  mainBalance: bigint,
  wrappedBalance: bigint,
  bptSupply: bigint,
  params: Params,
): bigint {
  // Amount in, so we round up overall.
  const previousNominalMain = _toNominal(mainBalance, params);
  const afterNominalMain = _toNominal(mainBalance - mainOut, params);
  const deltaNominalMain = previousNominalMain - afterNominalMain;
  const invariant = _calcInvariantDown(
    previousNominalMain,
    wrappedBalance,
    params,
  );
  return MathSol.divUp(MathSol.mul(bptSupply, deltaNominalMain), invariant);
}

export function _calcBptInPerWrappedOut(
  wrappedOut: bigint,
  mainBalance: bigint,
  wrappedBalance: bigint,
  bptSupply: bigint,
  params: Params,
): bigint {
  // Amount in, so we round up overall.
  const nominalMain = _toNominal(mainBalance, params);
  const previousInvariant = _calcInvariantUp(
    nominalMain,
    wrappedBalance,
    params,
  );
  const newWrappedBalance = wrappedBalance - wrappedOut;
  const newInvariant = _calcInvariantDown(
    nominalMain,
    newWrappedBalance,
    params,
  );
  const newBptBalance = MathSol.divDown(
    MathSol.mul(bptSupply, newInvariant),
    previousInvariant,
  );
  return bptSupply - newBptBalance;
}

export function _calcWrappedOutPerMainIn(
  mainIn: bigint,
  mainBalance: bigint,
  params: Params,
): bigint {
  // Amount out, so we round down overall.
  const previousNominalMain = _toNominal(mainBalance, params);
  const afterNominalMain = _toNominal(mainBalance + mainIn, params);
  const deltaNominalMain = afterNominalMain - previousNominalMain;
  return MathSol.divDownFixed(deltaNominalMain, params.rate);
}

export function _calcWrappedInPerMainOut(
  mainOut: bigint,
  mainBalance: bigint,
  params: Params,
): bigint {
  // Amount in, so we round up overall.
  const previousNominalMain = _toNominal(mainBalance, params);
  const afterNominalMain = _toNominal(mainBalance - mainOut, params);
  const deltaNominalMain = previousNominalMain - afterNominalMain;
  return MathSol.divUpFixed(deltaNominalMain, params.rate);
}

export function _calcMainInPerBptOut(
  bptOut: bigint,
  mainBalance: bigint,
  wrappedBalance: bigint,
  bptSupply: bigint,
  params: Params,
): bigint {
  // Amount in, so we round up overall.
  if (bptSupply == 0n) {
    return _fromNominal(bptOut, params);
  }
  const previousNominalMain = _toNominal(mainBalance, params);
  const invariant = _calcInvariantUp(
    previousNominalMain,
    wrappedBalance,
    params,
  );
  const deltaNominalMain = MathSol.divUp(
    MathSol.mul(invariant, bptOut),
    bptSupply,
  );
  const afterNominalMain = previousNominalMain + deltaNominalMain;
  const newMainBalance = _fromNominal(afterNominalMain, params);
  return newMainBalance - mainBalance;
}

export function _calcMainOutPerBptIn(
  bptIn: bigint,
  mainBalance: bigint,
  wrappedBalance: bigint,
  bptSupply: bigint,
  params: Params,
): bigint {
  // Amount out, so we round down overall.
  const previousNominalMain = _toNominal(mainBalance, params);
  const invariant = _calcInvariantDown(
    previousNominalMain,
    wrappedBalance,
    params,
  );
  const deltaNominalMain = MathSol.divDown(
    MathSol.mul(invariant, bptIn),
    bptSupply,
  );
  const afterNominalMain = previousNominalMain - deltaNominalMain;
  const newMainBalance = _fromNominal(afterNominalMain, params);
  return mainBalance - newMainBalance;
}

export function _calcMainOutPerWrappedIn(
  wrappedIn: bigint,
  mainBalance: bigint,
  params: Params,
): bigint {
  // Amount out, so we round down overall.
  const previousNominalMain = _toNominal(mainBalance, params);
  const deltaNominalMain = MathSol.mulDownFixed(wrappedIn, params.rate);
  const afterNominalMain = previousNominalMain - deltaNominalMain;
  const newMainBalance = _fromNominal(afterNominalMain, params);
  return mainBalance - newMainBalance;
}

export function _calcMainInPerWrappedOut(
  wrappedOut: bigint,
  mainBalance: bigint,
  params: Params,
): bigint {
  // Amount in, so we round up overall.
  const previousNominalMain = _toNominal(mainBalance, params);
  const deltaNominalMain = MathSol.mulUpFixed(wrappedOut, params.rate);
  const afterNominalMain = previousNominalMain + deltaNominalMain;
  const newMainBalance = _fromNominal(afterNominalMain, params);
  return newMainBalance - mainBalance;
}

export function _calcBptOutPerWrappedIn(
  wrappedIn: bigint,
  mainBalance: bigint,
  wrappedBalance: bigint,
  bptSupply: bigint,
  params: Params,
): bigint {
  // Amount out, so we round down overall.
  if (bptSupply == 0n) {
    // Return nominal DAI
    return MathSol.mulDownFixed(wrappedIn, params.rate);
  }

  const nominalMain = _toNominal(mainBalance, params);
  const previousInvariant = _calcInvariantUp(
    nominalMain,
    wrappedBalance,
    params,
  );
  const newWrappedBalance = wrappedBalance + wrappedIn;
  const newInvariant = _calcInvariantDown(
    nominalMain,
    newWrappedBalance,
    params,
  );
  const newBptBalance = MathSol.divDown(
    MathSol.mul(bptSupply, newInvariant),
    previousInvariant,
  );
  return newBptBalance - bptSupply;
}

export function _calcWrappedInPerBptOut(
  bptOut: bigint,
  mainBalance: bigint,
  wrappedBalance: bigint,
  bptSupply: bigint,
  params: Params,
): bigint {
  // Amount in, so we round up overall.
  if (bptSupply == 0n) {
    // Return nominal DAI
    return MathSol.divUpFixed(bptOut, params.rate);
  }

  const nominalMain = _toNominal(mainBalance, params);
  const previousInvariant = _calcInvariantUp(
    nominalMain,
    wrappedBalance,
    params,
  );
  const newBptBalance = bptSupply + bptOut;
  const newWrappedBalance = MathSol.divUpFixed(
    MathSol.divUp(MathSol.mul(newBptBalance, previousInvariant), bptSupply) -
      nominalMain,
    params.rate,
  );
  return newWrappedBalance - wrappedBalance;
}

export function _calcWrappedOutPerBptIn(
  bptIn: bigint,
  mainBalance: bigint,
  wrappedBalance: bigint,
  bptSupply: bigint,
  params: Params,
): bigint {
  // Amount out, so we round down overall.
  const nominalMain = _toNominal(mainBalance, params);
  const previousInvariant = _calcInvariantUp(
    nominalMain,
    wrappedBalance,
    params,
  );
  const newBptBalance = bptSupply - bptIn;
  const newWrappedBalance = MathSol.divUpFixed(
    MathSol.divUp(MathSol.mul(newBptBalance, previousInvariant), bptSupply) -
      nominalMain,
    params.rate,
  );
  return wrappedBalance - newWrappedBalance;
}

function _calcInvariantUp(
  nominalMainBalance: bigint,
  wrappedBalance: bigint,
  params: Params,
): bigint {
  return nominalMainBalance + MathSol.mulUpFixed(wrappedBalance, params.rate);
}

function _calcInvariantDown(
  nominalMainBalance: bigint,
  wrappedBalance: bigint,
  params: Params,
): bigint {
  return nominalMainBalance + MathSol.mulDownFixed(wrappedBalance, params.rate);
}

function _toNominal(real: bigint, params: Params): bigint {
  // Fees are always rounded down: either direction would work but we need to be consistent, and rounding down
  // uses less gas.
  if (real < params.lowerTarget) {
    const fees = MathSol.mulDownFixed(params.lowerTarget - real, params.fee);
    return MathSol.sub(real, fees);
  } else if (real <= params.upperTarget) {
    return real;
  } else {
    const fees = MathSol.mulDownFixed(real - params.upperTarget, params.fee);
    return MathSol.sub(real, fees);
  }
}

function _fromNominal(nominal: bigint, params: Params): bigint {
  // Since real = nominal + fees, rounding down fees is equivalent to rounding down real.
  if (nominal < params.lowerTarget) {
    return MathSol.divDownFixed(
      nominal + MathSol.mulDownFixed(params.fee, params.lowerTarget),
      MathSol.ONE + params.fee,
    );
  } else if (nominal <= params.upperTarget) {
    return nominal;
  } else {
    return MathSol.divDownFixed(
      nominal - MathSol.mulDownFixed(params.fee, params.upperTarget),
      MathSol.ONE - params.fee,
    );
  }
}

export function _calcTokensOutGivenExactBptIn(
  balances: bigint[],
  bptAmountIn: bigint,
  bptTotalSupply: bigint,
  bptIndex: number,
): bigint[] {
  /**********************************************************************************************
    // exactBPTInForTokensOut                                                                    //
    // (per token)                                                                               //
    // aO = tokenAmountOut             /        bptIn         \                                  //
    // b = tokenBalance      a0 = b * | ---------------------  |                                 //
    // bptIn = bptAmountIn             \     bptTotalSupply    /                                 //
    // bpt = bptTotalSupply                                                                      //
    **********************************************************************************************/

  // Since we're computing an amount out, we round down overall. This means rounding down on both the
  // multiplication and division.

  const bptRatio = MathSol.divDownFixed(bptAmountIn, bptTotalSupply);
  const amountsOut: bigint[] = new Array(balances.length);
  for (let i = 0; i < balances.length; i++) {
    // BPT is skipped as those tokens are not the LPs, but rather the preminted and undistributed amount.
    if (i != bptIndex) {
      amountsOut[i] = MathSol.mulDownFixed(balances[i], bptRatio);
    }
  }
  return amountsOut;
}
