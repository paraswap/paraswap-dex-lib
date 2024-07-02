const reverseAddressSubstitution = function ({
  callData,
  addresses,
  isSavedAddresses,
}: {
  callData: string;
  addresses: string[];
  isSavedAddresses: boolean;
}): string {
  let markerLength = isSavedAddresses ? 5 : 3; // 'RR' + 3 bytes or 'TT' + 1 byte
  let marker = isSavedAddresses ? 'RR' : 'TT';

  let index = 0;
  while (index < callData.length) {
    let foundIndex = callData.indexOf(marker, index);
    if (foundIndex === -1) {
      break; // Marker not found, stop processing
    } else if (foundIndex % 2 !== 0) {
      index++;
      continue;
    }

    let addressIndex: number;
    if (isSavedAddresses) {
      // Extract 3 bytes after 'RR', convert to int
      addressIndex = parseInt(
        callData.substring(foundIndex + 2, foundIndex + 5),
        16,
      );
    } else {
      // Extract 1 byte after 'TT', convert to int
      addressIndex = parseInt(
        callData.substring(foundIndex + 2, foundIndex + 3),
        16,
      );
    }

    if (addressIndex < addresses.length) {
      // Replace marker and index bytes with the corresponding address
      callData =
        callData.substring(0, foundIndex) +
        addresses[addressIndex] +
        callData.substring(foundIndex + markerLength);
    }
    index = foundIndex + 1; // Update index to continue searching
  }

  return callData;
};

export default reverseAddressSubstitution;
