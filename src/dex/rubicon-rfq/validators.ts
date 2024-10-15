import joi from 'joi';

const numberSchema = joi.string().pattern(/^\d+(\.\d+)?$/);

const pqSchema = joi
  .array()
  .items(joi.string().required(), joi.string().required())
  .length(2);

const marketSchema = joi.object({
  asks: joi.array().items(pqSchema).required(),
  bids: joi.array().items(pqSchema).required(),
});

export const marketsResponseValidator = joi.object({
  status: joi.string().valid('success', 'fail').required(),
  chainId: joi.string().pattern(/^\d+$/).required(),
  markets: joi.object().pattern(joi.string().min(1), marketSchema),
});

export const liquidityResponseValidator = joi.object({
  status: joi.string().valid('success', 'fail').required(),
  chainId: joi.string().pattern(/^\d+$/).required(),
  liquidityUsd: joi.object().pattern(joi.string().min(1), numberSchema),
});
