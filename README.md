# Ante v0.5 Core

[Ante](https://www.ante.finance) is a decentralized protocol to build the Schelling Point of Computational Trust.

## Introduction

ANTE stands for Autonomous Native Testing Environment. AnteV0.5 is meant to be an **alpha release**. Please use it at your own risk.

Ante makes it easy to create autonomous guarantees for any smart contract system on any blockchain. Those guarantees are verifiable by anyone in real-time. Others can later build upon those guarantees.
Ante enables more advanced and secure composition of DeFi primitives and existing financial service integrations.

[See our gitbook for more information](https://docs.ante.finance/antev05/)

## Installation

Install Node and NPM ([Instructions](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm))

```
Make sure to use Node version 14 or higher and NPM version 6 or higher
```

Clone the ante-v0-core repository

```
git clone git@github.com:anteproject/ante-v0-core.git
```

Install all required packages

```
npm install --save-dev
```

Configure the app

- copy [`.env.example`](./.env.example) to [`.env`](./.env) and fill in your Infura API Key, Alchemy API Key, the mainnet private key for your desired mainnet deployment address, and rinkeby memnonic phrase
- If you do not have mainnet or rinkeby credentials you can use dummy values
- An Alchemy API key is required to run the testing suite and can be obtained for free at [alchemy.com](https://www.alchemy.com/)
- An Infura API key can be obtained for free at [infura.io](https://infura.io/)

## Deploy

You can deploy the v0.5 smart contracts to `mainnet`, `rinkeby`, and to `localhost` (your own locally running Hardhat node)

If you are deploying contracts for the first time (and not working off of an existing deployment), first delete the contents of [`scripts/deployments`](./scripts/deployments).

To deploy, run the following command substituting one of the above networks for `NETWORK_NAME`

```
npm run deploy -- --network [NETWORK_NAME]
```

This command will deploy the following contracts

- [AntePoolFactory](./contracts/AntePoolFactory.sol)
- [AnteWBTCSupplyTest](./contracts/examples/AnteWBTCSupplyTest.sol) and associated [AntePool](./contracts/AntePool.sol)
- [AnteETHDevRugTest](./contracts/examples/AnteEthDevRugTest.sol) and associated [AntePool](./contracts/AntePool.sol)
- [AnteETH2DepositTest](./contracts/examples/AnteETH2DepositTest.sol) and associated [AntePool](./contracts/AntePool.sol)
- [AnteUSDCSupplyTest](./contracts/examples/AnteUSDCSupplyTest.sol) and associated [AntePool](./contracts/AntePool.sol)
- [AnteUSDTSupplyTest](./contracts/examples/AnteUSDTSupplyTest.sol) and associated [AntePool](./contracts/AntePool.sol)
- [AnteWETH9Test](./contracts/examples/AnteWETH9Test.sol.sol) and associated [AntePool](./contracts/AntePool.sol)

If you are deploying to your local hardhat node, you must first start the node by running `npm run node` in a separate terminal window

## Testing:

**All commands should be run from the root directory of the project unless otherwise specified**

To run unit tests against a local forked mainnet version, run

```
npm run test
```

**If you get an error like 'cannot find typechain directory', simply run the command again after the directory is created during the first failed attempt**

To check code coverage, run

```
npm run coverage
```

To run slither

```
npm run slither
```

To run solhint

```
npm run lint:sol
```

Full list of available commands can be found in [`package.json`](./package.json)

# Licensing

All Ante v0.5 code is licensed under GNU General Public License v3.0, see [`LICENSE`](./LICENSE).
