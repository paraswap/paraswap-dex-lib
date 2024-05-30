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
      const regexLongest = new RegExp(
        '((^[a-zA-Z0-9]{2})*)' + longestDuplicatedStringInCompressedData,
      );
      const match = regexLongest.exec(compressedCallData);

      // If a match is found, surrounder the longest duplicated string with the marker in the compressed data
      // and substitute the other occurences
      if (match) {
        const indexOfLongest = match.index + match[1].length;
        const regexLongestGlobal = new RegExp(
          '((^[a-zA-Z0-9]{2})*)' + longestDuplicatedStringInCompressedData,
          'g',
        );
        compressedCallData =
          compressedCallData.substring(0, indexOfLongest) +
          marker +
          compressedCallData.substring(
            indexOfLongest,
            indexOfLongest + longestDuplicatedStringInCompressedData.length,
          ) +
          marker +
          compressedCallData
            .substring(
              indexOfLongest + longestDuplicatedStringInCompressedData.length,
            )
            .replace(regexLongestGlobal, function (m, p1) {
              return p1 + marker;
            });
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
