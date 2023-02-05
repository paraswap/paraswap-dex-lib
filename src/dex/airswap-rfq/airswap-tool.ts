import { providers } from 'ethers';

export async function getStakersUrl(provider: providers.Provider) {
  return provider.getLogs({
    address: '0x05545815a5579d80Bd4c380da3487EAC2c4Ce299',
    fromBlock: 0,
    toBlock: 'latest',
  });
}
