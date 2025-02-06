import { BigNumber } from 'ethers';

const ONE = BigNumber.from(1);
const TWO = BigNumber.from(2);

export function sqrt(value: BigNumber) {
  let x = value;
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}

export function adjustTestSwapOutAmount(
  amountOut: bigint,
  outDecimals: number,
) {
  let normalisationDecimalFactor = outDecimals > 12 ? outDecimals - 12 : 0;
  return (
    ((amountOut * BigInt(10 ** 12)) / BigInt(10 ** outDecimals)) *
    BigInt(10 ** normalisationDecimalFactor)
  ).toString();
}
