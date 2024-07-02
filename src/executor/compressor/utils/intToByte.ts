const intToByte = (int: number): string => {
  let hex = int.toString(16);
  if (hex.length < 2) hex = '0' + hex;
  return hex;
};

export default intToByte;
