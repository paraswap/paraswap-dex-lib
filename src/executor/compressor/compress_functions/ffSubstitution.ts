import intToByte from '../utils/intToByte';

const ffByte = 'ff';
const zeroByte = '00';

const ffSubstitution = ({
  compressedCallData,
  indexOfMethods,
  addressPrefix,
  newAddressPrefix,
}: {
  compressedCallData: string;
  indexOfMethods: number;
  addressPrefix: string;
  newAddressPrefix: string;
}): string => {
  let ffCount = 0;
  let maxI: number;
  const startFFSearch = indexOfMethods > -1 ? 2 : 10;
  for (let i = startFFSearch; i < compressedCallData.length; i += 2) {
    const byte = compressedCallData.substring(i, i + 2);
    maxI = i;
    if (byte === ffByte) {
      if (++ffCount > 254) {
        // in case more than 255 bytes of ff
        compressedCallData =
          compressedCallData.substring(0, i + (1 - ffCount) * 2) +
          intToByte(ffCount) +
          compressedCallData.substring(i);
        i -= ffCount * 2;
        i += 2;
        ffCount = 0;
      }
      continue;
    }
    if (ffCount > 0) {
      if (ffCount === 1)
        compressedCallData =
          compressedCallData.substring(0, i) +
          zeroByte +
          compressedCallData.substring(i);
      else {
        compressedCallData =
          compressedCallData.substring(0, i + (1 - ffCount) * 2) +
          intToByte(ffCount) +
          compressedCallData.substring(i);
        i -= ffCount * 2;
      }
      i += 2;
      ffCount = 0;
    }
    if (byte === addressPrefix) i += 6;
    if (byte === newAddressPrefix) i += 2;
  }
  // console.log({ maxI: max, length: compressedCallData.length, compressedCallData });
  return compressedCallData;
};

export default ffSubstitution;
