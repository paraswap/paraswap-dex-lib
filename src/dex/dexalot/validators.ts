import joi from 'joi';

const pairValidator = joi.object({
  base: joi.string().min(1).required(),
  quote: joi.string().min(1).required(),
  liquidityUSD: joi.number().min(0).required(),
});

export const pairsResponseValidator = joi.object({
  pairs: joi.object().pattern(joi.string(), pairValidator),
});

const orderbookRecordValidator = joi
  .array()
  .items(joi.string().min(1))
  .length(2)
  .required();

const orderbookValidator = joi.object({
  bids: joi.array().items(orderbookRecordValidator).required(),
  asks: joi.array().items(orderbookRecordValidator).required(),
});

export const pricesResponseValidator = joi.object({
  prices: joi.object().pattern(joi.string(), orderbookValidator),
});

const tokenValidator = joi.object({
  symbol: joi.string().min(1).required(),
  name: joi.string().min(1).required(),
  description: joi.string().min(1).required(),
  address: joi.string().min(1).required(),
  decimals: joi.number().min(0).required(),
  type: joi.string().min(1).required(),
});

export const tokensResponseValidator = joi.object({
  tokens: joi.object().pattern(joi.string(), tokenValidator),
});

export const blacklistResponseValidator = joi.object({
  blacklist: joi.array().items(joi.string().min(1)).required(),
});
