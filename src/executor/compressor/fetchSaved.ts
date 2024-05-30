// import fetchSavedAddresses from './utils/fetchSavedAddresses';
// import fetchSavedMethods from './utils/fetchSavedMethods';
// import contractAddressByNetwork from './../data/contractAddressByNetwork';
// import fs from 'fs';

// const fetchSaved = async (): Promise<void> => {
//   setInterval(async () => {
//     for (const network in contractAddressByNetwork) {
//       const savedAddresses = await fetchSavedAddresses(network);
//       const savedMethods = await fetchSavedMethods(network);

//       fs.writeFileSync(`./lib/data/${network}/savedAddresses.js`, `module.exports = ${JSON.stringify(savedAddresses)}`);
//       fs.writeFileSync(`./lib/data/${network}/savedMethods.js`, `module.exports = ${JSON.stringify(savedMethods)}`);
//     }
//   }, 1000 * 300);
// };

// fetchSaved();
