import joi from 'joi';

export const priceValidator = joi.object({});

export const pricesResponse = joi.object({
  prices: joi.object().pattern(joi.string().min(1), priceValidator),
});
