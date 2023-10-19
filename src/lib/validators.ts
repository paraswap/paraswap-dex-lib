import joi from 'joi';

export class ValidationError extends Error {
  readonly rawMessage: string;

  readonly key?: string;

  constructor(message: string, key?: string) {
    super(key !== undefined ? `'${key}': ${message}` : message);
    this.rawMessage = message;
    this.key = key;
  }
}

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
