import computeCost from './computeCostL2';

const findLongestDuplicatedString = (string: string): string => {
  let maxLetters = '';
  let maxCost = 0;
  const allSames: string[] = [];

  for (let i = 0; i < string.length; i += 2) {
    let j = 0;
    let searchedString = string.substring(i, i + 2);

    while (string.substring(i + j * 2 + 2).indexOf(searchedString) > -1) {
      let cost = computeCost(searchedString);
      if (cost > maxCost) {
        maxLetters = searchedString;
        maxCost = cost;
      }
      j++;
      searchedString = string.substring(i, i + j * 2 + 2);
    }

    if (searchedString.length > 6) {
      allSames.push(searchedString.substring(0, searchedString.length - 2));
    }
  }

  return maxLetters;
};

export default findLongestDuplicatedString;
