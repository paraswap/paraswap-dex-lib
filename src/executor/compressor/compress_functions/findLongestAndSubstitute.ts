import findLongestDuplicatedString from '../utils/findLongestDuplicatedString';

const findLongestAndSubstitute = ({
  compressedCallData,
  markers,
}: {
  compressedCallData: string;
  markers?: string[];
}): { newCompressedData: string; nbOfDuplicatedStrings: number } => {
  if (!markers) markers = [];

  for (let i = 0; i < markers.length; i++) {
    if (!markers[i] || markers[i] === '')
      return {
        newCompressedData: compressedCallData,
        nbOfDuplicatedStrings: i,
      };

    const marker = markers[i];

    let longestDuplicatedStringInCompressedData =
      findLongestDuplicatedString(compressedCallData);

    // Checking if the length of the longest duplicated string is significant
    // TODO: better check conditions to enter this (nb of occurences as well as length)
    if (longestDuplicatedStringInCompressedData.length >= 8) {
      // Creating regular expressions to find the longest duplicated string
      const index = compressedCallData.indexOf(
        longestDuplicatedStringInCompressedData,
      );

      // If a match is found, surrounder the longest duplicated string with the marker in the compressed data
      // and substitute the other occurences
      if (index > -1) {
        compressedCallData =
          compressedCallData.substring(0, index) +
          marker +
          compressedCallData.substring(
            index,
            index + longestDuplicatedStringInCompressedData.length,
          ) +
          marker +
          compressedCallData.substring(
            index + longestDuplicatedStringInCompressedData.length,
          );

        let otherIndex = compressedCallData.indexOf(
          longestDuplicatedStringInCompressedData,
          index + 4 + longestDuplicatedStringInCompressedData.length,
        );
        while (otherIndex !== -1) {
          if (otherIndex % 2 === 0) {
            compressedCallData =
              compressedCallData.substring(0, otherIndex) +
              marker +
              compressedCallData.substring(
                otherIndex + longestDuplicatedStringInCompressedData.length,
              );
            otherIndex = compressedCallData.indexOf(
              longestDuplicatedStringInCompressedData,
              otherIndex + 2,
            );
          } else {
            otherIndex = compressedCallData.indexOf(
              longestDuplicatedStringInCompressedData,
              otherIndex + 1,
            );
          }
        }
      } else
        return {
          newCompressedData: compressedCallData,
          nbOfDuplicatedStrings: i,
        };
    } else {
      // If the longest duplicated string is not significant, return the current state of compressed data and count of duplicated strings
      return {
        newCompressedData: compressedCallData,
        nbOfDuplicatedStrings: i,
      };
    }
  }

  // After processing for all markers, return the final compressed data and the total number of duplicated strings found
  return {
    newCompressedData: compressedCallData,
    nbOfDuplicatedStrings: markers.length,
  };
};

export default findLongestAndSubstitute;
