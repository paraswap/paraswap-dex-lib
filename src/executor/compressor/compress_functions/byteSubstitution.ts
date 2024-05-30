import intToByte from '../utils/intToByte';

const byteSubstitution = ({
  byte,
  callData,
  compressedCallData,
  addressPrefix,
  newAddressPrefix,
}: {
  byte: string;
  callData: string;
  compressedCallData?: string;
  addressPrefix: string;
  newAddressPrefix: string;
}): { bufferOfOccurences: string; compressedCallData: string } => {
  let countNoByte = 0; // Count of non-target bytes
  let countByte = 0; // Count of target bytes
  let bufferOfOccurences = ''; // Stores occurrences of target bytes

  if (!compressedCallData) compressedCallData = '';

  // Looping through call data byte by byte
  for (let i = 0; i < callData.length; i += 2) {
    let amountToIncreaseI = 0;
    const currentByte = callData.slice(i, i + 2);

    // Handling target byte substitution
    if (currentByte === byte) {
      if (countNoByte > 0 || i == 0) {
        compressedCallData += byte;
        countNoByte = 0;
      }
      // Handle byte count exceeding limit
      if (++countByte > 254) {
        let hexValue = intToByte(countByte);
        bufferOfOccurences += hexValue;
        compressedCallData += byte + hexValue;
        countByte = 0;
      }
      continue;
    } else {
      // Handle other bytes and address prefixes
      if (countByte > 0) {
        let hexValue = intToByte(countByte);
        if (byte === 'ff' && countByte === 1) hexValue = '00';
        bufferOfOccurences += hexValue;
        compressedCallData += hexValue;
        countByte = 0;
      }
      // Check for address and new address prefixes
      if (currentByte === addressPrefix || currentByte === newAddressPrefix) {
        let sliceLength = currentByte === addressPrefix ? 8 : 4;
        compressedCallData += callData.slice(i, i + sliceLength);
        amountToIncreaseI = sliceLength - 2;
        countNoByte = 0;
      }
      countNoByte++;
    }
    if (!amountToIncreaseI) compressedCallData += callData.slice(i, i + 2);
    i += amountToIncreaseI;
  }

  // Append remaining byte counts after loop
  if (countByte > 0) {
    let hexValue = intToByte(countByte);
    bufferOfOccurences += hexValue;
    compressedCallData += hexValue;
  }

  return { bufferOfOccurences, compressedCallData };
};

export default byteSubstitution;
