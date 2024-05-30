const intTo3Bytes = (int: number): string => {
  let hex = int.toString(16);
  if (hex.length < 2) hex = '00000' + hex;
  else if (hex.length < 3) hex = '0000' + hex;
  else if (hex.length < 4) hex = '000' + hex;
  else if (hex.length < 5) hex = '00' + hex;
  else if (hex.length < 6) hex = '0' + hex;

  return hex;
};

export default intTo3Bytes;
