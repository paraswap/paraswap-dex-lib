'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isOrderTradable =
  exports.findAndRemoveLeading =
  exports.toDirectionKey =
  exports.fromPairKey =
  exports.toPairKey =
    void 0;
// Compare tokens using the default locale
var compareTokens = function (token0, token1) {
  return token0.localeCompare(token1);
};
var SEPARATOR = '->-<-';
// Convert two tokens to a string key
var toKey = function (tokens) {
  // Check if the array has exactly two elements
  if (tokens.length !== 2) {
    throw new Error(
      'Invalid number of tokens: expected 2, got '.concat(tokens.length),
    );
  }
  // Check if tokens are the same, and throw an error if they are
  if (tokens[0] === tokens[1]) {
    throw new Error(
      'Cannot create key for identical tokens: '.concat(tokens[0]),
    );
  }
  return tokens.join(SEPARATOR);
};
// Convert two tokens to a string key
var toPairKey = function (token0, token1) {
  // Sort tokens and turn to key
  return toKey([token0, token1].sort(compareTokens));
};
exports.toPairKey = toPairKey;
var fromPairKey = function (key) {
  var tokens = key.split(SEPARATOR);
  return [tokens[0], tokens[1]];
};
exports.fromPairKey = fromPairKey;
// Convert two tokens to a string key, order matters
var toDirectionKey = function (token0, token1) {
  return toKey([token0, token1]);
};
exports.toDirectionKey = toDirectionKey;
// find and return an element in an array, and remove it and all elements before it. If not found, remove all elements.
var findAndRemoveLeading = function (arr, predicate) {
  var element = undefined;
  do {
    element = arr.shift();
  } while (element && !predicate(element));
  return element;
};
exports.findAndRemoveLeading = findAndRemoveLeading;
function isOrderTradable(order) {
  return order.y.gt(0) && (order.A.gt(0) || order.B.gt(0));
}
exports.isOrderTradable = isOrderTradable;
