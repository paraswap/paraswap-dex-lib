'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ContractsApi = void 0;
var Composer_1 = require('./Composer');
var Contracts_1 = require('./Contracts');
var Reader_1 = require('./Reader');
/**
 * Class that handles the interaction with contracts through a provider.
 */
var ContractsApi = /** @class */ (function () {
  function ContractsApi(provider, config) {
    var contracts = new Contracts_1.default(provider, config);
    this._reader = new Reader_1.default(contracts);
    this._composer = new Composer_1.default(contracts);
  }
  Object.defineProperty(ContractsApi.prototype, 'reader', {
    get: function () {
      return this._reader;
    },
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(ContractsApi.prototype, 'composer', {
    get: function () {
      return this._composer;
    },
    enumerable: false,
    configurable: true,
  });
  return ContractsApi;
})();
exports.ContractsApi = ContractsApi;
