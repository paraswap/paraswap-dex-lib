'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var types_1 = require('../abis/types');
var config_1 = require('./config');
var Contracts = /** @class */ (function () {
  function Contracts(provider, config) {
    this._config = config_1.config;
    this._provider = provider;
    this._config.carbonControllerAddress =
      (config === null || config === void 0
        ? void 0
        : config.carbonControllerAddress) ||
      config_1.config.carbonControllerAddress;
    this._config.multiCallAddress =
      (config === null || config === void 0
        ? void 0
        : config.multiCallAddress) || config_1.config.multiCallAddress;
    this._config.voucherAddress =
      (config === null || config === void 0 ? void 0 : config.voucherAddress) ||
      config_1.config.voucherAddress;
  }
  Object.defineProperty(Contracts.prototype, 'carbonController', {
    get: function () {
      if (!this._carbonController)
        this._carbonController = types_1.CarbonController__factory.connect(
          this._config.carbonControllerAddress,
          this._provider,
        );
      return this._carbonController;
    },
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(Contracts.prototype, 'multicall', {
    get: function () {
      if (!this._multiCall)
        this._multiCall = types_1.Multicall__factory.connect(
          this._config.multiCallAddress,
          this._provider,
        );
      return this._multiCall;
    },
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(Contracts.prototype, 'voucher', {
    get: function () {
      if (!this._voucher)
        this._voucher = types_1.Voucher__factory.connect(
          this._config.voucherAddress,
          this._provider,
        );
      return this._voucher;
    },
    enumerable: false,
    configurable: true,
  });
  Contracts.prototype.token = function (address) {
    return types_1.Token__factory.connect(address, this._provider);
  };
  Object.defineProperty(Contracts.prototype, 'provider', {
    get: function () {
      return this._provider;
    },
    enumerable: false,
    configurable: true,
  });
  return Contracts;
})();
exports.default = Contracts;
