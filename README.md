# Dex Lib

## Description

This is the tooling that allows you to connect new Dexes to `ParaSwap API`

## Start

- Prepare the project:

```bash
git clone git@github.com:paraswap/paraswap-dex-lib.git
yarn install
```

- Initialize `your-dex-name` new Dex:

```bash
yarn init-integration your-dex-name
```

- Run tests for `your-dex-name`:

```bash
yarn test-integration your-dex-name
```

**Notice:** The first argument (name) must be provided in `param-case`. Only "a-z", "0-9", and "-" letters are allowed.
