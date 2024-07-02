import intToByte from './../utils/intToByte';
import intTo3Bytes from '../utils/intTo3Bytes';

const addressSubstitution = ({
  callData,
  addresses,
  isSavedAddresses,
}: {
  callData: string;
  addresses: string[];
  isSavedAddresses: boolean;
}): string => {
  for (let i = 0; i < addresses.length; i++) {
    if (addresses[i] === '0000000000000000000000000000000000000000') continue;
    let index = callData.indexOf(addresses[i]);
    if (index === -1) continue;
    while (index !== -1) {
      if (index % 2 === 0) {
        callData =
          callData.substring(0, index) +
          (isSavedAddresses ? 'RR' : 'TT') +
          (!isSavedAddresses ? intToByte(i) : intTo3Bytes(i)) +
          callData.substring(index + addresses[i].length);
      }
      index = callData.indexOf(addresses[i], index + 1);
    }
  }

  return callData;
};

export default addressSubstitution;
