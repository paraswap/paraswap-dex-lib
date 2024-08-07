import axios from 'axios';
const networks = [1, 56, 137, 1101, 43114, 250, 42161, 10, 8453];

async function getData(network: number) {
  const urlV6 = `https://api.paraswap.io/adapters/list?namesOnly=true&network=${network}&version=6.2`;
  const urlV5 = `https://api.paraswap.io/adapters/list?namesOnly=true&network=${network}&version=5`;

  const dexesV5 = (await axios.get(urlV5)).data;
  const dexesV6 = (await axios.get(urlV6)).data;

  const dexesV6Only = dexesV6.filter((dex: string) => !dexesV5.includes(dex));

  return dexesV6Only;
}

async function main() {
  for (const network of networks) {
    const result = await getData(network);
    console.log(`Network: ${network}. Dexes V6 only: ${result}\n\n`);
  }
}

main();
