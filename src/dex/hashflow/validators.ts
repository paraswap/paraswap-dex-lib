import joi from 'joi';

export const levelValidator = joi.array().items(
  joi.object({
    pair: joi.object({
      baseTokenName: joi.string().min(1).required(),
      quoteTokenName: joi.string().min(1).required(),
      baseToken: joi.string().min(1).required(),
      quoteToken: joi.string().min(1).required(),
      baseTokenDecimals: joi.number().min(1).required(),
      quoteTokenDecimals: joi.number().min(1).required(),
    }),
    levels: joi.array().items(
      joi.object({
        q: joi.string().min(1).required(),
        p: joi.string().min(1).required(),
      }),
    ),
  }),
);

export const pricesResponseValidator = joi.object({
  status: joi.string().required(),
  // networkId: joi.number().required(),
  baseChain: joi.object({
    chainType: joi.string().required(),
    chainId: joi.number().required(),
  }),
  quoteChain: joi.object({
    chainType: joi.string().required(),
    chainId: joi.number().required(),
  }),
  levels: joi.object().pattern(joi.string().min(1), levelValidator),
});

export const marketMakersValidator = joi.object({
  marketMakers: joi.array().items(joi.string().min(1).required()),
});
