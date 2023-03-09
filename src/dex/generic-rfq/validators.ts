import BigNumber from 'bignumber.js';
import joi, { CustomHelpers, ErrorReport } from 'joi';
import * as ethers from 'ethers';

const tokensType = ['ERC20'];

export class ValidationError extends Error {
  readonly rawMessage: string;

  readonly key?: string;

  constructor(message: string, key?: string) {
    super(key !== undefined ? `'${key}': ${message}` : message);
    this.rawMessage = message;
    this.key = key;
  }
}

export const tokenValidator = joi.object({
  symbol: joi.string().min(1).required(),
  name: joi.string().min(1).required(),
  address: joi.string().min(1).required(),
  description: joi.string(),
  decimals: joi.number().min(1).required(),
  type: joi
    .string()
    .valid(...tokensType)
    .required(),
});

export const tokensResponseValidator = joi.object({
  tokens: joi.object().pattern(joi.string().min(1), tokenValidator),
});

export const pairValidator = joi.object({
  base: joi.string().min(1).required(),
  quote: joi.string().min(1).required(),
  liquidityUSD: joi.number().min(0).required(),
});

export const pairsResponseValidator = joi.object({
  pairs: joi.object().pattern(joi.string(), pairValidator),
});

const stringNumberValidator = (
  value: string,
  helpers: CustomHelpers,
): string | ErrorReport => {
  const bn = new BigNumber(value);
  if (bn.toString() === 'NaN') {
    return helpers.message({
      custom: `${value} is not a number`,
    });
  }

  return value;
};

const pricesValidatorWithoutSorting = joi
  .array()
  .items(
    joi
      .array()
      .items(joi.string().min(1).custom(stringNumberValidator))
      .length(2),
  );

const ext: joi.Extension = {
  type: 'sortedArray',
  base: pricesValidatorWithoutSorting,
  rules: {
    asc: {
      validate: (values: string[], helpers: CustomHelpers) => {
        const prices = values.map(numbers => new BigNumber(numbers[0]));
        const isAscOrder = prices.every(
          (x, i) => i === 0 || x.gte(prices[i - 1]),
        );
        return isAscOrder
          ? values
          : helpers.message({
              custom: `array is not asc sorted ${JSON.stringify(values)}`,
            });
      },
    },
    desc: {
      validate: (values: string[][], helpers: CustomHelpers) => {
        const prices = values.map(numbers => new BigNumber(numbers[0]));
        const isAscOrder = prices.every(
          (x, i) => i === 0 || x.lte(prices[i - 1]),
        );
        return isAscOrder
          ? values
          : helpers.message({
              custom: `array is not desc sorted ${JSON.stringify(values)}`,
            });
      },
    },
  },
};

const pricesArrayValidator = joi.extend(ext);

export const priceValidator = joi.object({
  bids: pricesArrayValidator.sortedArray().desc(),
  asks: pricesArrayValidator.sortedArray().asc(),
});

export const pricesResponse = joi.object({
  prices: joi.object().pattern(joi.string().min(1), priceValidator),
});

export const validateAndCast = <T>(
  value: unknown,
  schema: joi.Schema,
  name?: string,
): T => {
  const { error, value: parsed } = schema.validate(value);

  if (error !== undefined) {
    let message;
    if (name) {
      message = `"${name}" ${error.message.slice(
        error.message.indexOf('must'),
      )}`;
    } else {
      message = error.message;
    }
    throw new ValidationError(message);
  }
  return parsed as T;
};

export const addressSchema = joi.string().custom((value, helpers) => {
  if (ethers.utils.isAddress(value)) {
    return value.toLowerCase();
  }
  return helpers.message({ custom: `'${value}' is not valid address` });
});

export const blacklistResponseValidator = joi.object({
  blacklist: joi.array().items(addressSchema),
});

const stringPositiveBigIntValidator = (
  value: string,
  helpers: CustomHelpers,
): string | ErrorReport => {
  try {
    const val = BigInt(value);
    if (val < 0) {
      return helpers.message({ custom: `${value} is < 0` });
    }
    return value;
  } catch (e) {
    return helpers.message({
      custom: `${value} is not castable to BigInt`,
    });
  }
};

const stringStartWithHex0x = (
  value: string,
  helpers: CustomHelpers,
): string | ErrorReport => {
  if (!value.startsWith('0x')) {
    return helpers.message({
      custom: `${value} is not castable to BigInt`,
    });
  }

  return value;
};

export const orderWithSignatureValidator = joi
  .object({
    nonceAndMeta: joi.string().custom(stringPositiveBigIntValidator),
    expiry: joi.number().min(0),
    maker: addressSchema.required(),
    taker: addressSchema.required(),
    makerAsset: addressSchema.required(),
    takerAsset: addressSchema.required(),
    makerAmount: joi
      .string()
      .min(1)
      .custom(stringPositiveBigIntValidator)
      .required(),
    takerAmount: joi
      .string()
      .min(1)
      .custom(stringPositiveBigIntValidator)
      .required(),
    signature: joi.string().custom(stringStartWithHex0x),
  })
  .unknown(true);

export const firmRateResponseValidator = joi
  .object({
    order: orderWithSignatureValidator.required(),
  })
  .unknown(true);
