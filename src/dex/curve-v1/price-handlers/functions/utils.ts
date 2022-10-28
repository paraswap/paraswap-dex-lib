import { ImplementationNames } from '../../types';

export const funcNotExist = (
  funcName: string,
  implementationName: ImplementationNames,
): never => {
  throw new Error(`${funcName} doesn't exist on ${implementationName}`);
};

export const requireConstant = <T>(
  value: T | undefined,
  constantName: string,
  funcName: string,
  implementationName: ImplementationNames,
): T => {
  if (value === undefined) {
    throw new Error(
      `Required constant ${constantName} was not specified for function ` +
        `${funcName} in ${implementationName} implementation`,
    );
  }
  return value;
};
