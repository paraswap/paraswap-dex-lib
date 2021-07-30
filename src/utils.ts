import { ETHER_ADDRESS } from "./constants";

export const isETHAddress = (address: string) =>
    address.toLowerCase() === ETHER_ADDRESS.toLowerCase()