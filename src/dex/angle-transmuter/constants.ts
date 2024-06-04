import { ethers } from 'ethers';
import { bigIntify } from '../../utils';
import { ChainlinkConfig, PoolConfig, PythConfig } from './types';

export const CBETH = '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704';
export const RETH = '0xae78736Cd615f374D3085123A210448E74Fc6393';
export const STETH = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
export const SFRXETH = '0xac3E018457B222d93114458476f3E3416Abbe38F';
export const BLOCK_UPGRADE_ORACLE = 19567142;

export const configEUR: PoolConfig = {
  stablecoin: {
    address: '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8',
    decimals: 18,
  },
  transmuter: '0x00253582b2a3FE112feEC532221d9708c64cEFAb',
  collaterals: [
    '0x3f95AA88dDbB7D9D484aa3D482bf0a80009c52c9',
    '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
    '0x2F123cF3F37CE3328CC9B5b8415f9EC5109b45e7',
  ],
  oracles: {
    chainlink: {},
    backed: {
      '0x83Ec02059F686E747392A22ddfED7833bA0d7cE3': {
        proxy: '0x83Ec02059F686E747392A22ddfED7833bA0d7cE3',
        aggregator: '0x83Ec02059F686E747392A22ddfED7833bA0d7cE3',
        decimals: 8,
      },
      '0x475855DAe09af1e3f2d380d766b9E630926ad3CE': {
        proxy: '0x475855DAe09af1e3f2d380d766b9E630926ad3CE',
        aggregator: '0x475855DAe09af1e3f2d380d766b9E630926ad3CE',
        decimals: 8,
      },
    },
    redstone: {
      '0x6E27A25999B3C665E44D903B2139F5a4Be2B6C26': {
        proxy: '0x6E27A25999B3C665E44D903B2139F5a4Be2B6C26',
        aggregator: '0x5BeEFeFE23aecccC77d164AB8E9Ff74e056588f1',
        decimals: 8,
      },
    },
    morpho: {},
    pyth: {
      proxy: '0x4305FB66699C3B2702D4d05CF36551390A4c69C6',
      ids: [
        '0x76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c',
        '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
      ],
    },
  },
};

export const configUSD: PoolConfig = {
  stablecoin: {
    address: '0x0000206329b97DB379d5E1Bf586BbDB969C63274',
    decimals: 18,
  },
  transmuter: '0x222222fD79264BBE280b4986F6FEfBC3524d0137',
  collaterals: [
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    '0xCA30c93B02514f86d5C86a6e375E3A330B435Fb5',
    '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB',
  ],
  oracles: {
    backed: {} as ChainlinkConfig,
    chainlink: {
      '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6': {
        proxy: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
        aggregator: '0x789190466E21a8b78b8027866CBBDc151542A26C',
        decimals: 8,
      },
      '0x32d1463EB53b73C095625719Afa544D5426354cB': {
        proxy: '0x32d1463EB53b73C095625719Afa544D5426354cB',
        aggregator: '0x5EE6Ee50c1cB3E8Da20eE83D57818184387433e8',
        decimals: 8,
      },
    },
    redstone: {} as ChainlinkConfig,
    morpho: {
      '0x025106374196586E8BC91eE8818dD7B0Efd2B78B': {
        baseVault: '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB',
        baseVaultConversion: bigIntify('1000000000000000000'),
        quoteVault: ethers.constants.AddressZero,
        quoteVaultConversion: bigIntify('1'),
        baseFeed1: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
        baseFeed2: ethers.constants.AddressZero,
        quoteFeed1: ethers.constants.AddressZero,
        quoteFeed2: ethers.constants.AddressZero,
        scaleFactor: bigIntify('1000000000000000000'),
      },
    },
    pyth: {} as PythConfig,
  },
};
