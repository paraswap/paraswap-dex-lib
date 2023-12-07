import { BigNumber, BigNumberish } from 'ethers';

export const fixedSize = (s: string, len: number) => {
  if (s.length > len)
    throw new Error(`given size (${s.length}) is too big to fit in ${len}`);
  return s.padStart(len, '0');
};

// numberToCallData returns a hex-encoded number, without the `0x` prefix, with desired number of bytes
function numberToCallData(amount: BigNumberish, numBytes: number): string {
  return fixedSize(
    BigNumber.from(amount).toHexString().replace('0x', ''),
    numBytes * 2,
  );
}

class MantissaFormattedNumber {
  type: number;
  exponent: number;
  mantissa: BigNumber;

  private constructor(exponent: number, mantissa: BigNumber, type: number) {
    this.type = type;
    this.exponent = exponent;
    this.mantissa = mantissa;
  }

  static from(_value: BigNumberish, _type: number): MantissaFormattedNumber {
    const value = BigNumber.from(_value);
    let PRECISION = BigNumber.from('2').pow(8 * (2 * _type + 3));
    let MAX_EXPONENT = 60;

    if (value == BigNumber.from(0))
      return new MantissaFormattedNumber(0, BigNumber.from(0), 0);

    let exponent = 0;
    let mantissa = value;

    while (mantissa.gte(PRECISION)) {
      mantissa = mantissa.div(10);
      exponent++;
    }

    if (exponent > MAX_EXPONENT) {
      throw 'exponent too big';
    }

    // make the mantissa smaller if the precision is the same
    while (mantissa.mod(10).eq(0) && exponent < MAX_EXPONENT) {
      mantissa = mantissa.div(10);
      exponent++;
    }

    // Represent the mantissa with the smallest possible type
    let type = _type;
    if (type > 1 && mantissa.lt(BigNumber.from('2').pow(40))) type = 1;
    if (type > 0 && mantissa.lt(BigNumber.from('2').pow(24))) type = 0;

    return new MantissaFormattedNumber(exponent, mantissa, type);
  }

  getHexString(): string {
    let hexString = numberToCallData(this.type * 64 + this.exponent, 1);
    hexString += numberToCallData(this.mantissa, 2 * this.type + 3);
    return hexString;
  }
}

export function getSwapExactInputSingleFallbackData(
  orderBookId: number,
  isAsk: boolean,
  exactInput: BigNumberish,
  minOutput: BigNumberish,
  unwrap: boolean,
) {
  const ExactInputSingleFallbackStart = 8;

  let data = '0x';
  const recipientIsMsgSender = true;
  data += BigNumber.from(
    ExactInputSingleFallbackStart +
      Number(unwrap) +
      2 * Number(recipientIsMsgSender),
  )
    .toHexString()
    .replace('0x', '');

  // orderBookId & isAsk
  if (orderBookId > 127) {
    throw `orderBookId too big for compressed form ${orderBookId}`;
  }
  const compressed = BigNumber.from(orderBookId).toNumber() + (isAsk ? 128 : 0);
  data += numberToCallData(compressed, 1);

  data += MantissaFormattedNumber.from(exactInput, 2).getHexString();
  data += MantissaFormattedNumber.from(minOutput, 2).getHexString();
  return data;
}

export function getSwapExactOutputSingleFallbackData(
  orderBookId: number,
  isAsk: boolean,
  exactOutput: BigNumberish,
  maxInput: BigNumberish,
  unwrap: boolean,
) {
  const ExactOutputSingleFallbackStart = 12;

  let data = '0x';
  const recipientIsMsgSender = true;
  data += BigNumber.from(
    ExactOutputSingleFallbackStart +
      Number(unwrap) +
      2 * Number(recipientIsMsgSender),
  )
    .toHexString()
    .replace('0x', '');

  // orderBookId & isAsk
  if (orderBookId > 127) {
    throw `orderBookId too big for compressed form ${orderBookId}`;
  }
  const compressed = BigNumber.from(orderBookId).toNumber() + (isAsk ? 128 : 0);
  data += numberToCallData(compressed, 1);

  data += MantissaFormattedNumber.from(exactOutput, 2).getHexString();
  data += MantissaFormattedNumber.from(maxInput, 2).getHexString();
  return data;
}
