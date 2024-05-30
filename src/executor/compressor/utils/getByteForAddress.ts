import intTo3Bytes from './intTo3Bytes';

const getByteForAddress = (
  addresses: string[],
  address: string,
): string | null => {
  const index = addresses.indexOf(address.toLowerCase());
  if (index < 0) return null;

  return intTo3Bytes(index);
};

export default getByteForAddress;
