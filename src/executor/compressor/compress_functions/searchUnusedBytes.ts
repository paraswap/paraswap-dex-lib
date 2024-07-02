import intToByte from '../utils/intToByte';

const searchUnusedBytes = ({
  newAddresses,
  compressedCallData,
}: {
  newAddresses: string[];
  compressedCallData: string;
}): {
  addressPrefix: string;
  newAddressPrefix: string;
  duplicatedStringMarkers: string[];
} => {
  let addressPrefix = '';
  let newAddressPrefix = '';
  let duplicatedStringMarkers: string[] = [];

  for (let i = 1; i < 256; i++) {
    if (
      addressPrefix.length &&
      (newAddressPrefix.length || !newAddresses.length) &&
      duplicatedStringMarkers.length === 6
    )
      break;

    let byte = intToByte(i);
    if (!compressedCallData.includes(byte)) {
      if (!addressPrefix.length) addressPrefix = byte;
      else if (!newAddressPrefix.length && newAddresses.length)
        newAddressPrefix = byte;
      else if (duplicatedStringMarkers.length < 6)
        duplicatedStringMarkers.push(byte);
    }
  }

  return {
    addressPrefix,
    newAddressPrefix,
    duplicatedStringMarkers,
  };
};

export default searchUnusedBytes;
