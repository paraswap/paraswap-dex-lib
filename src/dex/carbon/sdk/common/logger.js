'use strict';
var __spreadArray =
  (this && this.__spreadArray) ||
  function (to, from, pack) {
    if (pack || arguments.length === 2)
      for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.Logger = void 0;
var numerics_1 = require('../utils/numerics');
var globalObject = (function () {
  try {
    return self;
  } catch (e) {
    try {
      return window;
    } catch (e) {
      return global;
    }
  }
})();
function getVerbosityLevel() {
  if (globalObject !== undefined) {
    return Number(globalObject.CARBON_DEFI_SDK_VERBOSITY) || 0;
  }
  return 0;
}
var verbosity = getVerbosityLevel();
function isVerbose() {
  return verbosity >= 1;
}
function shouldConvertBigNumbersToStrings() {
  return verbosity >= 2;
}
var originalLog = console.log;
function convertBigNumbersToStrings(obj) {
  if (obj instanceof numerics_1.BigNumber) {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigNumbersToStrings);
  }
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(function (_a) {
        var key = _a[0],
          value = _a[1];
        return [key, convertBigNumbersToStrings(value)];
      }),
    );
  }
  return obj;
}
if (shouldConvertBigNumbersToStrings()) {
  console.debug = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }
    var convertedArgs = args.map(convertBigNumbersToStrings);
    originalLog.apply(console, convertedArgs);
  };
}
var Logger = /** @class */ (function () {
  function Logger(file) {
    this._prefix = '[SDK]['.concat(file, ']:');
  }
  Logger.prototype.error = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }
    console.error.apply(console, __spreadArray([this._prefix], args, false));
  };
  Logger.prototype.log = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }
    console.log.apply(console, __spreadArray([this._prefix], args, false));
  };
  Logger.prototype.debug = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }
    isVerbose() &&
      console.debug.apply(console, __spreadArray([this._prefix], args, false));
  };
  return Logger;
})();
exports.Logger = Logger;
