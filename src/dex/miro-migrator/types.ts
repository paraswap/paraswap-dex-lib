import { Address } from '../../types';

export type MiroMigratorData = null;

export type DexParams = {
  migratorAddress: Address;
  pspTokenAddress: Address;
  xyzTokenAddress: Address;
};

export enum MiroMigratorFunctions {
  migratePSPtoXYZ = 'migratePSPtoXYZ',
}
