import joi from 'joi';

const levelItemValidator = joi.array().length(2).items(joi.number().required());

const tradingPairValidator = joi.object({
  base_symbol: joi.string().required(),
  base_address: joi.string().length(42).required(), // Assuming Ethereum address
  quote_symbol: joi.string().required(),
  quote_address: joi.string().length(42).required(), // Assuming Ethereum address
  levels: joi.array().items(levelItemValidator).required(),
  side: joi.string().valid('ask', 'bid').required(),
  minimum_in_base: joi.number().min(0).required(),
});

export const levelsResponseValidator = joi.array().items(tradingPairValidator);

const tokenValidator = joi.object({
  id: joi.number().integer().required(),
  chain: joi.string().required(),
  address: joi
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .required(),
  symbol: joi.string().required(),
  decimals: joi.number().integer().min(0).required(),
  name: joi.string().allow('').required(),
  logo: joi.string().uri().allow(null),
  desc: joi.string().allow(null),
  featured: joi.boolean().required(),
  is_supported: joi.boolean().required(),
  stablecoin: joi.boolean().required(),
});

export const getTokensResponseValidator = joi.array().items(tokenValidator);

export const getQuoteResponseValidator = joi.object({
  from: joi
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .required(),
  to: joi
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .required(),
  struct: joi.any().required(),
  calldata: joi.string().required(),
});
