import joi from 'joi';

// const pairValidator = joi.object({
//   base: joi.string().min(1).required(),
//   quote: joi.string().min(1).required(),
//   liquidityUSD: joi.number().min(0).required(),
//   baseAddress: joi.string().min(1).required(),
//   quoteAddress: joi.string().min(1).required(),
//   baseDecimals: joi.number().min(0).required(),
//   quoteDecimals: joi.number().min(0).required(),
// });

// export const pairsResponseValidator = joi
//   .object()
//   .pattern(joi.string(), pairValidator);

const levelValidator = joi.array().items(joi.number()).length(2);

const pairValidator = joi.object({
  bids: joi.array().items(levelValidator).required(),
  asks: joi.array().items(levelValidator).required(),
  last_update_ts: joi.number().min(0).required(),
});

export const pricesResponseValidator = joi
  .object()
  .pattern(joi.string(), pairValidator);

const tokenValidator = joi
  .object({
    ticker: joi.string().min(1).required(),
    contractAddress: joi.string().min(1).required(),
    decimals: joi.number().min(0).required(),
  })
  .unknown(true);

export const tokensResponseValidator = joi.object({
  tokens: joi.object().pattern(joi.string(), tokenValidator),
});

export const blacklistResponseValidator = joi.object({
  blacklist: joi.array().items(joi.string().min(1)).required(),
});
