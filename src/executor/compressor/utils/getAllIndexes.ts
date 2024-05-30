function getAllIndexes<T>(arr: T[], val: T): number[] {
  let indexes: number[] = [];
  let i = -1;

  while ((i = arr.indexOf(val, i + 1)) != -1) {
    indexes.push(i);
  }
  return indexes;
}

export default getAllIndexes; // Function to get all indexes of a specific value in an array
