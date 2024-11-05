import joi from 'joi';
import protobuf from 'protobufjs';

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

const root = protobuf.loadSync('src/dex/bebop/bebop.proto');
export const BebopPricingUpdate = root.lookupType('bebop.BebopPricingUpdate');
