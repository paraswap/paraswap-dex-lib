import intTo3Bytes from '../utils/intTo3Bytes';

const addressSubstitutionFromObject = ({
  callData,
  addressesObject,
}: {
  callData: string;
  addressesObject: { [key: string]: { saved: boolean; index: number } };
}): string => {
  const addresses: string[] = [];
  for (let i = 0; i < callData.length; i += 2) {
    let callDataPart = callData.slice(i, i + 40);
    if (addressesObject['0x' + callDataPart]) addresses.push(callDataPart);
  }
  for (let i = 0; i < addresses.length; i++) {
    if (addresses[i] === '0000000000000000000000000000000000000000') continue;
    let index = callData.indexOf(addresses[i]);
    if (index === -1) continue;
    if (addressesObject['0x' + addresses[i]].index === -1) continue;

    const bytes3 = intTo3Bytes(addressesObject['0x' + addresses[i]].index);

    while (index !== -1) {
      if (index % 2 === 0) {
        callData =
          callData.substring(0, index) +
          bytes3 +
          callData.substring(index + addresses[i].length);
      }
      index = callData.indexOf(addresses[i], index + 1);
    }
  }
  return callData;
};

export default addressSubstitutionFromObject;
