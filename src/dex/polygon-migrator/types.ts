import { Address } from '../../types';

export type PolygonMigrationData = null;

export type DexParams = {
  migratorAddress: Address;
  polTokenAddress: Address;
  maticTokenAddress: Address;
};

export enum PolygonMigratorFunctions {
  migrate = 'migrate',
  unmigrate = 'unmigrate',
}
