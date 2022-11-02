import { ImplementationNames, PoolContextConstants } from '../../types';
import { IPoolContext } from '../types';

export const throwNotExist = (
  funcName: string,
  implementationName: ImplementationNames,
): never => {
  throw new Error(`${funcName} doesn't exist on ${implementationName}`);
};

export const throwNotImplemented = (
  funcName: string,
  implementationName: ImplementationNames,
): never => {
  throw new Error(`${funcName} is not implemented on ${implementationName}`);
};

// Get rid of undefined for constants
export const requireConstant = <T extends keyof PoolContextConstants>(
  self: IPoolContext,
  constantName: T,
  funcName: string,
): NonNullable<PoolContextConstants[T]> => {
  const value = self.constants[constantName];
  if (!value) {
    throw new Error(
      `Required constant ${constantName} was not specified for function ` +
        `${funcName} in ${self.IMPLEMENTATION_NAME} implementation`,
    );
  }

  // Proper typing is not working. I do not know why :(
  return value as NonNullable<PoolContextConstants[T]>;
};
