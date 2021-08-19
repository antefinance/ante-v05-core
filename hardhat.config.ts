
import { HardhatUserConfig } from "hardhat/config";

const { private_key, infura_key, alchemy_key } = require('./secret.json');

import "hardhat-abi-exporter";
import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";

const config: HardhatUserConfig = {
  networks: {
    localhost: {
      url: "http://localhost:8545",
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infura_key}`,
      accounts: [private_key]   
    },
    hardhat: {
      //forking: {
      //  url: `https://eth-mainnet.alchemyapi.io/v2/${alchemy_key}`,
      //}
    }
  },
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: false,
        //runs: 200,
      },
    },
  },
};

export default config;