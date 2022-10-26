import { ImplementationNames } from '../../types';

export const funcNotExist = (
  funcName: string,
  implementationName: ImplementationNames,
): never => {
  throw new Error(`${funcName} doesn't exist on ${implementationName}`);
};
