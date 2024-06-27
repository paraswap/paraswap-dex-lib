import intTo3Bytes from '../utils/intTo3Bytes';

const ZERO_ADDRESS = '0000000000000000000000000000000000000000';

const addressSubstitutionFromObject = ({
  callData,
  addressesObject,
}: {
  callData: string;
  addressesObject: { [key: string]: { saved: boolean; index: number } };
}): string => {
  const addresses: string[] = [];

  for (let i = 0; i < callData.length; i += 2) {
    const callDataPart = callData.slice(i, i + 40);
    const addressObj = addressesObject[`0x${callDataPart}`];

    if (addressObj?.saved) addresses.push(callDataPart);
  }

  addresses
    .filter(address => {
      const notZero = address !== ZERO_ADDRESS;
      const inCalldata = callData.indexOf(address) !== -1;
      const isSaved = addressesObject[`0x${address}`].saved;
      return notZero && inCalldata && isSaved;
    })
    .forEach(address => {
      let index = callData.indexOf(address);
      console.log(address, addressesObject);
      const bytes3 = intTo3Bytes(addressesObject[`0x${address}`].index);

      while (index !== -1) {
        if (index % 2 === 0) {
          callData =
            callData.substring(0, index) +
            bytes3 +
            callData.substring(index + address.length);
        }
        index = callData.indexOf(address, index + 1);
      }
    });

  return callData;
};

export default addressSubstitutionFromObject;
