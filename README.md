# Dex Lib

## Description

This is the tooling that allows you to connect new Dexes to `ParaSwap API`

## Start

- To prepare the project, run the commands:

```bash
git clone git@github.com:paraswap/paraswap-dex-lib.git
yarn install
```

`Init` and `Test` new Dex:

- `yarn init-integration your-dex-name` - specify the name of your Dex to initialize it
- `yarn test-integration your-dex-name` - specify the name of the Dex to run tests for

**Notice:** The first argument (name) must be provided in `param-case`. Only "a-z", "0-9", and "-" letters are allowed.
