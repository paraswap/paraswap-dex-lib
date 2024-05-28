import { FunctionFragment, Interface } from '@ethersproject/abi';
import { RETURN_AMOUNT_POS_0, RETURN_AMOUNT_POS_32 } from './constants';

export const extractReturnAmountPosition = (
  iface: Interface,
  functionName: string | FunctionFragment,
  outputName = '',
): number => {
  const func =
    typeof functionName === 'string'
      ? iface.getFunction(functionName)
      : functionName;
  const outputs = func.outputs || [];
  const index = outputs.findIndex(({ name }) => name === outputName || outputName === '' && name === null);

  if (index < 0) {
    throw new Error(
      `Function ${functionName} was not found in the provided abi`,
    );
  }

  if (index === 0) {
    return RETURN_AMOUNT_POS_0;
  }

  let position = RETURN_AMOUNT_POS_0;
  let curIndex = 0;
  while (curIndex < index) {
    position += RETURN_AMOUNT_POS_32;
    curIndex ++;
  }

  return position;
};
