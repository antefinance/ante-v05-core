# Ante v0.5 Core

[Ante](https://www.ante.finance) is a decentralized protocol to build the Schelling Point of Computational Trust.

## Introduction

Ante hosts incentivized unit tests on-chain.

Ante makes it easy to create and stake trustless guarantees about smart contract projects. Those open guarantees ("Ante Tests") are verifiable by anyone in real-time. Others can build upon them and view explicit data about the community's trust in a project.

Ante makes **trust in a protocol** explicit and measurable, which enables safer composition of DeFi primitives and could accelerate global financial integration.

[See our gitbook for more information](https://docs.ante.finance/antev05/)

Disclaimer: While Ante (Autonomous Native Testing Environment) v0.5 is audited, it is an **alpha release.** Please use it at your own risk.

## Deployed Contracts
**Mainnets**
| **Network**       | **Address**  |
|:------------------|:-------------|
| Ethereum Mainnet  | [0xa03492A9A663F04c51684A3c172FC9c4D7E02eDc](https://etherscan.io/address/0xa03492a9a663f04c51684a3c172fc9c4d7e02edc) |
| Avalanche C-Chain | [0x18aB6357f673696375018f006B86fE44F195DE1f](https://snowtrace.io/address/0x18ab6357f673696375018f006b86fe44f195de1f) |

**Testnets**
| **Network**      | **Address**   |
|:-----------------|:--------------|
| Ethereum Rinkeby | [0x5a8b70edfd28A79756B54ed8DbeeE13e566920Aa](https://rinkeby.etherscan.io/address/0x5a8b70edfd28a79756b54ed8dbeee13e566920aa) |
| Avalanche Fuji   | [0x45D520f5d0F8FB9Bd68aE16eC5B84fC341df0EA0](https://testnet.snowtrace.io/address/0x45d520f5d0f8fb9bd68ae16ec5b84fc341df0ea0) |

## Installation

Install Node and NPM ([Instructions](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm))

```
Make sure to use Node version 14 or higher and NPM version 6 or higher
```

Clone the ante-v0-core repository

```
git clone git@github.com:antefinance/ante-v0-core.git
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

- [`AntePoolFactory`](./contracts/AntePoolFactory.sol)
- [`AnteWBTCSupplyTest`](./contracts/examples/AnteWBTCSupplyTest.sol) and associated [`AntePool`](./contracts/AntePool.sol)
- [`AnteETHDevRugTest`](./contracts/examples/AnteEthDevRugTest.sol) and associated [`AntePool`](./contracts/AntePool.sol)
- [`AnteETH2DepositTest`](./contracts/examples/AnteETH2DepositTest.sol) and associated [`AntePool`](./contracts/AntePool.sol)
- [`AnteUSDCSupplyTest`](./contracts/examples/AnteUSDCSupplyTest.sol) and associated [`AntePool`](./contracts/AntePool.sol)
- [`AnteUSDTSupplyTest`](./contracts/examples/AnteUSDTSupplyTest.sol) and associated [`AntePool`](./contracts/AntePool.sol)
- [`AnteWETH9Test`](./contracts/examples/AnteWETH9Test.sol.sol) and associated [`AntePool`](./contracts/AntePool.sol)

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

# Bug Bounty

We are offering a [bug bounty program](./bug-bounty.md) for previously undiscovered bugs.

# Licensing

All Ante v0.5 code is licensed under GNU General Public License v3.0, see [`LICENSE`](./LICENSE).
