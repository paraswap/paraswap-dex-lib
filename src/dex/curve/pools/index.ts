import { PoolTypes } from '../constants';
import type { BaseCurveEventPool } from './base-pool';
import { CurveEventLendingPool } from './lending-pool';
import { CurveEventMetaLendingPool } from './meta-lending-pool';
import { CurveEventMetaPool } from './meta-pool';
import { CurveEventPool } from './stable-pool';

export const poolClassMappings = new Map<PoolTypes, typeof BaseCurveEventPool>([
  [PoolTypes.STABLE, CurveEventPool],
  [PoolTypes.LENDING, CurveEventLendingPool],
  [PoolTypes.META, CurveEventMetaPool],
  [PoolTypes.META_LENDING, CurveEventMetaLendingPool],
]);
