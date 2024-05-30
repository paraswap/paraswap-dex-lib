import computeCost from './utils/computeCostL2';
import intToByte from './utils/intToByte';

import searchUnusedBytes from './compress_functions/searchUnusedBytes';
import byteSubstitution from './compress_functions/byteSubstitution';
import findLongestAndSubstitute from './compress_functions/findLongestAndSubstitute';
import addressSubstitution from './compress_functions/addressSubstitution';
import addressSubstitutionFromObject from './compress_functions/addressSubstitutionFromObject';

const zeroByte = '00';
const ffByte = 'ff';

interface CompressInput {
  initialCallData: string;
  savedAddresses?: string[];
  newAddresses?: string[];
  savedMethods?: string[];
  options?: any;
  network?: string;
}

interface CompressOutput {
  compressedData: string;
  initialCost: number;
  finalCost: number;
}

const compress = function ({
  initialCallData,
  savedAddresses,
  newAddresses,
  savedMethods,
  options,
  network,
}: CompressInput): CompressOutput {
  let storedAddresses: any;
  let storedMethods: any;
  // if (network) {
  //   try {
  //     storedAddresses = require('../data/' + network + '/savedAddresses.js');
  //   } catch (err) {
  //     console.log(err);
  //   }
  //   try {
  //     storedMethods = require('../data/' + network + '/savedMethods.js');
  //   } catch (err) {
  //     console.log(err);
  //   }
  // }
  if (storedMethods) savedMethods = storedMethods;

  if (initialCallData.length % 2 !== 0)
    throw new Error('Initial data of odd length');

  if (!options) options = {};
  if (!savedAddresses) savedAddresses = [];
  if (!newAddresses) newAddresses = [];
  if (!savedMethods) savedMethods = [];

  const initialCost = computeCost(initialCallData);

  let callData: string;
  if (initialCallData.startsWith('0x')) {
    callData = initialCallData.slice(2);
  } else {
    callData = initialCallData;
  }

  // SAVED ADDRESSES SUBSTITUTIONS
  if (!options.skipAddressSubstitution) {
    if (storedAddresses) {
      // mostly for prod efficiency (many saved addresses)
      callData = addressSubstitutionFromObject({
        callData,
        addressesObject: storedAddresses,
      });
    } else if (Array.isArray(savedAddresses)) {
      // mostly for tests
      savedAddresses = savedAddresses.map(addr =>
        addr.substring(2).toLocaleLowerCase(),
      );
      callData = addressSubstitution({
        callData,
        addresses: savedAddresses,
        isSavedAddresses: true,
      });
    }
  }

  if (!options.skipNewAddressSubstitution) {
    // NEW ADDRESSES REMOVING USELESS AND HIGHLIGHTING GOOD
    newAddresses = newAddresses
      .map(addr => addr.substring(2).toLocaleLowerCase())
      .filter(addr => callData.includes(addr));
    // console.log({newAddresses})

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
    callData: callData.substring(8),
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
      savedAddresses,
      newAddresses,
      savedMethods,
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
      savedAddresses,
      newAddresses,
      savedMethods,
      options: {
        skipNewAddressSubstitution: true,
      },
      network,
    });
  }

  // INDEX OF METHOD SUBSTITUTION
  const indexOfMethods = savedMethods
    .map(sm => (sm.startsWith('0x') ? sm.slice(2) : sm))
    .indexOf(callData.substring(0, 8));
  if (indexOfMethods > -1) {
    compressedCallData = intToByte(indexOfMethods) + compressedCallData;
  } else {
    compressedCallData = ffByte + callData.substring(0, 8) + compressedCallData;
  }

  const newAddressesString = options.skipNewAddressSubstitution
    ? '00'
    : intToByte(newAddresses.length) +
      (newAddresses.length > 0 ? newAddressPrefix : '') +
      newAddresses.join('');
  const prefixCallData = addressPrefix + newAddressesString;

  // SUBSTITUTING FF
  const firstBytes =
    indexOfMethods > -1
      ? compressedCallData.substring(0, 2)
      : compressedCallData.substring(0, 10);
  const compressedFFSubstituted = byteSubstitution({
    byte: ffByte,
    callData: compressedCallData.substring(indexOfMethods > -1 ? 2 : 10),
    compressedCallData: firstBytes,
    addressPrefix: options.skipAddressSubstitution ? 'RR' : addressPrefix,
    newAddressPrefix: options.skipNewAddressSubstitution
      ? 'TT'
      : newAddressPrefix,
  });
  compressedCallData = compressedFFSubstituted.compressedCallData;

  // FINDING LONGEST RECURRENT STRINGS TO COMPRESS
  let { newCompressedData, nbOfDuplicatedStrings } = findLongestAndSubstitute({
    compressedCallData: compressedCallData.substring(
      indexOfMethods > -1 ? 2 : 10,
    ),
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
  //      maxByteInZeroes (1B) | substitution of method index (1/5B) | compressedData | 00 | duplicatedStringMarkers

  const finalCost = computeCost(compressedCallData);
  if (compressedCallData.length % 2 !== 0)
    throw new Error('Data of odd length');
  return { compressedData: compressedCallData, initialCost, finalCost };
};

export default compress;
