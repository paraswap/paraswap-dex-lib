import computeCost from './utils/computeCostL2';
import intToByte from './utils/intToByte';

import searchUnusedBytes from './compress_functions/searchUnusedBytes';
import byteSubstitution from './compress_functions/byteSubstitution';
import findLongestAndSubstitute from './compress_functions/findLongestAndSubstitute';
import addressSubstitution from './compress_functions/addressSubstitution';
import addressSubstitutionFromObject from './compress_functions/addressSubstitutionFromObject';
import { pickBy } from 'lodash';

const zeroByte = '00';
const ffByte = 'ff';

export type AddressesMapping = Record<
  string,
  { saved: boolean; index: number }
>;

interface CompressInput {
  initialCallData: string;
  addresses: AddressesMapping;
  options?: any;
  network?: string;
}

interface CompressOutput {
  compressedData: string;
  initialCost: number;
  finalCost: number;
}

const trimHex = (hex: string) => {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
};

const compress = function ({
  initialCallData,
  addresses,
  options,
  network,
}: CompressInput): CompressOutput {
  if (initialCallData.length % 2 !== 0)
    throw new Error('Initial data of odd length');

  if (!options) options = {};

  const initialCost = computeCost(initialCallData);
  initialCallData = trimHex(initialCallData);
  let callData = initialCallData;

  const savedAddresses = pickBy(addresses, v => v.saved);

  let newAddresses = Object.keys(pickBy(addresses, v => !v.saved)).map(
    address => address.substring(2).toLocaleLowerCase(),
  );

  // SAVED ADDRESSES SUBSTITUTIONS
  if (!options.skipAddressSubstitution) {
    callData = addressSubstitutionFromObject({
      callData,
      addressesObject: savedAddresses,
    });
  }

  if (!options.skipNewAddressSubstitution) {
    // NEW ADDRESSES REMOVING USELESS AND HIGHLIGHTING GOOD
    newAddresses = newAddresses.filter(addr => callData.includes(addr));

    // NEW ADDRESSES SUBSTITUTIONS
    callData = addressSubstitution({
      callData,
      addresses: newAddresses,
      isSavedAddresses: false,
    });
  }

  // ZEROES SUBSTITUTIONS
  // I couldn't get ride of 0 around addresses because of potential zeroes absence around addresses in later call data formats
  // An idea could be to have another address prefix to handle this case (one with both sides having 00 by default), but it doesn't optimize that much
  let { compressedCallData, bufferOfOccurences } = byteSubstitution({
    byte: zeroByte,
    callData,
    addressPrefix: 'RR',
    newAddressPrefix: 'TT',
  });
  let numberOfZeroes = bufferOfOccurences;
  // console.log({numberOfZeroes})

  // COUNTING BYTES AND CHOSING MAX BYTE IN ZEROES
  // Counting bytes occurences in numberOfZeroes
  let byteCountsInZeroes: Record<string, number> = {};
  for (let i = 0; i < numberOfZeroes.length; i += 2) {
    const byte = numberOfZeroes.substring(i, i + 2);
    if (!byteCountsInZeroes[byte]) byteCountsInZeroes[byte] = 1;
    else byteCountsInZeroes[byte]++;
  }

  // Finding max byte in numberOfZeroes
  let maxByteInZeroes = '';
  let maxInZeroes = 0;
  for (let byte of Object.keys(byteCountsInZeroes)) {
    if (byteCountsInZeroes[byte] > maxInZeroes) {
      maxInZeroes = byteCountsInZeroes[byte];
      maxByteInZeroes = byte;
    }
  }

  // Substituting max byte of numberOfZeroes in compressedData
  for (let i = 0; i < compressedCallData.length; i += 2) {
    const currentByte = compressedCallData.slice(i, i + 2);
    if (currentByte === zeroByte) {
      if (i < compressedCallData.length - 2) {
        const nextByte = compressedCallData.slice(i + 2, i + 4);
        if (nextByte === maxByteInZeroes) {
          compressedCallData =
            compressedCallData.substring(0, i + 2) +
            zeroByte +
            compressedCallData.substring(i + 4);
          i += 2;
        }
      }
    } else if (currentByte === 'RR') i += 6;
    else if (currentByte === 'TT') i += 2;
  }
  // console.log({maxByteInZeroes, maxInZeroes, compressedCallData})

  // SEARCH FOR UNIQUE ADDRESSES PREFIXES AND DUPLICATED STRING MARKERS
  let { addressPrefix, newAddressPrefix, duplicatedStringMarkers } =
    searchUnusedBytes({
      newAddresses,
      compressedCallData,
    });
  // console.log({addressPrefix, newAddressPrefix, duplicatedStringMarkers})

  // ADDRESSES PREFIX SUBSTITUTIONS
  if (
    addressPrefix &&
    addressPrefix !== '' &&
    !options.skipAddressSubstitution
  ) {
    const regex = new RegExp('RR', 'g');
    compressedCallData = compressedCallData.replace(regex, addressPrefix);
  } else if (addressPrefix === '' && !options.skipAddressSubstitution) {
    // If no unused byte for addressPrefix remove the logic for address
    return compress({
      initialCallData: initialCallData,
      addresses,
      options: {
        skipAddressSubstitution: true,
        skipNewAddressSubstitution: true,
      },
      network,
    });
  } else if (options.skipAddressSubstitution) {
    addressPrefix = '00';
  }

  if (
    newAddressPrefix &&
    newAddressPrefix !== '' &&
    !options.skipNewAddressSubstitution
  ) {
    const regex = new RegExp('TT', 'g');
    compressedCallData = compressedCallData.replace(regex, newAddressPrefix);
  } else if (
    newAddressPrefix === '' &&
    newAddresses.length &&
    !options.skipNewAddressSubstitution
  ) {
    // If no unused byte for newAddressPrefix remove the logic for address
    return compress({
      initialCallData: initialCallData,
      addresses,
      options: {
        skipNewAddressSubstitution: true,
      },
      network,
    });
  }

  // INDEX OF METHOD SUBSTITUTION
  compressedCallData = ffByte + trimHex(compressedCallData);

  const newAddressesString = options.skipNewAddressSubstitution
    ? '00'
    : intToByte(newAddresses.length) +
      (newAddresses.length > 0 ? newAddressPrefix : '') +
      newAddresses.join('');
  const prefixCallData = addressPrefix + newAddressesString;

  // SUBSTITUTING FF
  const firstBytes = compressedCallData.substring(0, 2);
  const compressedFFSubstituted = byteSubstitution({
    byte: ffByte,
    callData: compressedCallData.substring(2),
    compressedCallData: firstBytes,
    addressPrefix: options.skipAddressSubstitution ? 'RR' : addressPrefix,
    newAddressPrefix: options.skipNewAddressSubstitution
      ? 'TT'
      : newAddressPrefix,
  });
  compressedCallData = compressedFFSubstituted.compressedCallData;

  // FINDING LONGEST RECURRENT STRINGS TO COMPRESS
  let { newCompressedData, nbOfDuplicatedStrings } = findLongestAndSubstitute({
    compressedCallData: compressedCallData.substring(2),
    markers: duplicatedStringMarkers,
  });
  if (newCompressedData) compressedCallData = firstBytes + newCompressedData;

  if (!maxByteInZeroes) maxByteInZeroes = '00';
  compressedCallData =
    '0x' + prefixCallData + maxByteInZeroes + compressedCallData + zeroByte;

  // We append the markers at the end of the string to find them back in the contract
  for (let i = 0; i < nbOfDuplicatedStrings; i++) {
    compressedCallData += duplicatedStringMarkers[i];
  }
  // 0x + address prefix (1B) | nbOfNewAddresses (1B) | newAddressPrefix (0/1B) | newAddresses (n * 20B) |
  //      maxByteInZeroes (1B) | FF | compressedData | 00 | duplicatedStringMarkers

  const finalCost = computeCost(compressedCallData);
  if (compressedCallData.length % 2 !== 0)
    throw new Error('Data of odd length');
  return { compressedData: compressedCallData, initialCost, finalCost };
};

export default compress;
