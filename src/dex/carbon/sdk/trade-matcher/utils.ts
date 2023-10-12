import { Rate } from '../common/types';

export const sortByMinRate = (x: Rate, y: Rate): number => {
  const lhs = x.output.mul(y.input);
  const rhs = y.output.mul(x.input);
  const lt = lhs.lt(rhs);
  const gt = lhs.gt(rhs);
  const eq = !lt && !gt;
  const is_lt = lt || (eq && x.output.lt(y.output));
  const is_gt = gt || (eq && x.output.gt(y.output));
  return +is_lt - +is_gt;
};

export const sortByMaxRate = (x: Rate, y: Rate): number => sortByMinRate(y, x);
