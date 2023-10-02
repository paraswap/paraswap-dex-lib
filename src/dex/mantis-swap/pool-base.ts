import { DeepReadonly } from 'ts-essentials';
import {
  PartialEventSubscriber,
  ComposedEventSubscriber,
} from '../../composed-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MantisPoolState } from './types';
import { Token } from '../../types';
import { BI_POWS } from '../../bigint-constants';

export const ONE_18 = BI_POWS[18];
const ONE_8 = BI_POWS[8];
const ONE = BigInt(0x10000000000000000);
const LN2 = BigInt(0xb17217f7d1cf79ac);

function exp(x: bigint): bigint {
  if (x < -818323753292969962227) return 0n;
  x = (x * ONE) / LN2;
  let shift;
  let z;
  if (x >= 0) {
    shift = x / ONE;
    z = x % ONE;
  } else {
    shift = x / ONE - 1n;
    z = ONE - (-x % ONE);
  }
  let zpow = z;
  let result = ONE;
  result += (BigInt(0xb17217f7d1cf79ab) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x3d7f7bff058b1d50) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0xe35846b82505fc5) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x276556df749cee5) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x5761ff9e299cc4) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0xa184897c363c3) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0xffe5fe2c4586) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x162c0223a5c8) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x1b5253d395e) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x1e4cf5158b) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x1e8cac735) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x1c3bd650) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x1816193) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x131496) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0xe1b7) * zpow) / ONE;
  zpow = (zpow * z) / ONE;
  result += (BigInt(0x9c7) * zpow) / ONE;

  if (shift >= 0) {
    if (result >> (256n - shift) > 0) return 2n ** 256n - 1n;
    return result << shift;
  } else return result >> -shift;
}

function positiveExponential(_x: bigint): bigint {
  const x = (_x * ONE) / ONE_18;
  return (exp(x) * ONE_18) / ONE;
}

function negativeExponential(_x: bigint): bigint {
  const x = -1n * ((_x * ONE) / ONE_18);
  return (exp(x) * ONE_18) / ONE;
}

function getSlippage(
  lr: bigint,
  slippageA: bigint,
  slippageN: bigint,
  slippageK: bigint,
): bigint {
  if (lr <= slippageK) {
    return (slippageA * negativeExponential(slippageN * lr)) / 10n;
  } else if (lr < 2n * slippageK) {
    return (
      (slippageA *
        (negativeExponential(slippageN * (2n * slippageK - lr)) -
          2n *
            (negativeExponential(slippageN * slippageK) -
              negativeExponential(slippageN * lr)))) /
      10n
    );
  } else {
    // extra case only to handle unsigned int when 2k < lr. Mathematically same
    return (
      (slippageA *
        (positiveExponential(slippageN * (lr - 2n * slippageK)) -
          2n *
            (negativeExponential(slippageN * slippageK) -
              negativeExponential(slippageN * lr)))) /
      10n
    );
  }
}

function getSwapSlippageFactor(
  a: bigint,
  n: bigint,
  k: bigint,
  oldFromLR: bigint,
  newFromLR: bigint,
  oldToLR: bigint,
  newToLR: bigint,
): bigint {
  let negativeFromSlippage = 0n;
  let negativeToSlippage = 0n;
  if (newFromLR > oldFromLR) {
    negativeFromSlippage =
      ((getSlippage(oldFromLR, a, n, k) - getSlippage(newFromLR, a, n, k)) *
        ONE_18) /
      (newFromLR - oldFromLR);
  }
  if (oldToLR > newToLR) {
    negativeToSlippage =
      ((getSlippage(newToLR, a, n, k) - getSlippage(oldToLR, a, n, k)) *
        ONE_18) /
      (oldToLR - newToLR);
  }

  let toFactor = ONE_18 + negativeFromSlippage - negativeToSlippage;
  if (toFactor > 2n * ONE_18) {
    toFactor = 2n * ONE_18;
  } else if (toFactor < 0) {
    toFactor = 0n;
  }
  return toFactor;
}

function getTotalAssetLiability(
  fromAddress: string,
  toAddress: string,
  toAmount: bigint,
  state: MantisPoolState,
): bigint[] {
  let totalAsset = 0n;
  let totalLiability = 0n;
  for (const tokenAddress of Object.keys(state.asset)) {
    if (tokenAddress != fromAddress) {
      const price = (state.chainlink[tokenAddress].answer * ONE_18) / ONE_8; // Assuming 8 decimal feeds always
      let asset = state.asset[tokenAddress].asset;
      let liability = state.asset[tokenAddress].liability;
      const decimalPower = BI_POWS[state.asset[tokenAddress].decimals];
      if (tokenAddress == toAddress) {
        asset -= toAmount;
      }
      totalAsset += (asset * price) / decimalPower;
      totalLiability += (liability * price) / decimalPower;
    }
  }
  return [totalAsset, totalLiability];
}

function checkRisk(
  fromToken: Token,
  toToken: Token,
  toAmount: bigint,
  state: MantisPoolState,
): boolean {
  const risk = state.params.riskProfile[fromToken.address];
  if (risk == 0n) {
    return true;
  }
  const [totalAsset, totalLiability] = getTotalAssetLiability(
    fromToken.address,
    toToken.address,
    toAmount,
    state,
  );
  if (totalLiability == 0n) {
    return true;
  } else {
    return (totalAsset * ONE_18) / totalLiability >= risk;
  }
}

function getNLR(state: MantisPoolState): bigint {
  const [totalAsset, totalLiability] = getTotalAssetLiability(
    '',
    '',
    0n,
    state,
  );
  if (totalLiability == 0n) {
    return ONE_18;
  } else {
    return (totalAsset * ONE_18) / totalLiability;
  }
}

function getFeesRatio(nlr: bigint, state: MantisPoolState): bigint {
  let swapFee = 0n;
  if (nlr < 96n * BI_POWS[16]) {
    swapFee = 4n * state.params.baseFee;
  } else if (nlr < ONE_18) {
    swapFee = 2n * state.params.baseFee;
  } else {
    swapFee = state.params.baseFee;
  }
  return swapFee;
}

export function calcPrice(
  srcToken: Token,
  destToken: Token,
  fromAmount: bigint,
  idealToAmount: bigint,
  state: MantisPoolState,
): bigint {
  if (state.asset[destToken.address].asset < idealToAmount) return 0n;
  let fromAsset = state.asset[srcToken.address].asset;
  let fromLiability = state.asset[srcToken.address].liability;
  let toAsset = state.asset[destToken.address].asset;
  let toLiability = state.asset[destToken.address].liability;

  let toAmount =
    (idealToAmount *
      getSwapSlippageFactor(
        state.params.slippageA,
        state.params.slippageN,
        state.params.slippageK,
        (fromAsset * ONE_18) / fromLiability,
        ((fromAsset + fromAmount) * ONE_18) / fromLiability,
        (toAsset * ONE_18) / toLiability,
        ((toAsset - idealToAmount) * ONE_18) / toLiability,
      )) /
    ONE_18;

  if (!checkRisk(srcToken, destToken, toAmount, state)) {
    return 0n;
  }
  const nlr = getNLR(state);
  const fees = (toAmount * getFeesRatio(nlr, state)) / BI_POWS[6];
  return toAmount - fees;
}

export abstract class MantisPoolBase<
  State extends MantisPoolState,
> extends ComposedEventSubscriber<State> {
  constructor(
    readonly dexKey: string,
    protected readonly network: number,
    name: string,
    dexHelper: IDexHelper,
    parts: PartialEventSubscriber<State, any>[],
    blankState: DeepReadonly<State>,
  ) {
    super(
      dexKey,
      name,
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
