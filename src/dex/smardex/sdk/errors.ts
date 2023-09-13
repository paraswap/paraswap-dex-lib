/**
 * SmardexError class
 *
 * @class SmardexError extends Error
 */
export default class SmardexError extends Error {
  /**
   * Create SmardexError object
   *
   * @param {string} message - error message
   * @param {string} [errorName=SmarDexSDK] - identifier for the error
   * @returns {SmardexError} SmarDex Error object
   */
  constructor(message: string, errorName = 'SmarDexSDK') {
    super(message);
    this.name = errorName;
  }
}
