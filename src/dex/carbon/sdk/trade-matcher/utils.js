'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.sortByMaxRate = exports.sortByMinRate = void 0;
var sortByMinRate = function (x, y) {
  var lhs = x.output.mul(y.input);
  var rhs = y.output.mul(x.input);
  var lt = lhs.lt(rhs);
  var gt = lhs.gt(rhs);
  var eq = !lt && !gt;
  var is_lt = lt || (eq && x.output.lt(y.output));
  var is_gt = gt || (eq && x.output.gt(y.output));
  return +is_lt - +is_gt;
};
exports.sortByMinRate = sortByMinRate;
var sortByMaxRate = function (x, y) {
  return (0, exports.sortByMinRate)(y, x);
};
exports.sortByMaxRate = sortByMaxRate;
