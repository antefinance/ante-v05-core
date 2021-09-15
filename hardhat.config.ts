import { config as dotenvconfig } from 'dotenv';
dotenvconfig();

import { HardhatUserConfig } from 'hardhat/config';

//const { private_key, infura_key, alchemy_key } = require('./secret.json');

import 'hardhat-abi-exporter';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import '@tenderly/hardhat-tenderly';
import 'solidity-coverage';

const config: HardhatUserConfig = {
  networks: {
    localhost: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: 13089428,
      },
      url: 'http://localhost:8545',
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.MAINNET_PRIVATE_KEY || ''],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: {
        mnemonic: process.env.RINKEBY_MNEMONIC || '',
      },
    },
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: 13089428,
      },
    },
  },
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY,
  },
};

export default config;
