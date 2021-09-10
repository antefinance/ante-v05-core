import hre from 'hardhat';
import path from 'path';
import { Contract } from 'ethers';

import * as constants from './constants';
import {
  currentCommitHash,
  deployAndRecord,
  emptyDeployment,
  loadDeployment,
  saveDeployment,
  deployTestPoolAndRecord,
} from './helpers';

// deploys Ante Tests and creates Ante Pools for each
const deployLaunchTestsAndPools = async (
  poolFactory: Contract,
  deployment: constants.Deployment,
  network: string,
  deploymentFile: string
) => {
  // Edit this list to change the tests deployed by this script
  const launchTests = [
    'AnteETH2DepositTest',
    'AnteUSDCSupplyTest',
    'AnteUSDTSupplyTest',
    'AnteWETH9Test',
    'AnteEthDevRugTest',
    'AnteWBTCSupplyTest',
    'AnteRevertingTest',
  ];

  for (const testName of launchTests) {
    if (testName in deployment.testPools) {
      console.log(`Found existing deployment for ${testName}, skipping...`);
      continue;
    }

    let args: any[];
    switch (testName) {
      case 'AnteWBTCSupplyTest': {
        args = [constants.deployConsts[network].WBTC];
        break;
      }
      case 'AnteWETH9Test': {
        args = [constants.deployConsts[network].WETH];
        break;
      }
      case 'AnteETH2DepositTest': {
        args = [constants.deployConsts[network].ETH2];
        break;
      }
      case 'AnteUSDCSupplyTest': {
        args = [constants.deployConsts[network].USDC];
        break;
      }
      case 'AnteUSDTSupplyTest': {
        args = [constants.deployConsts[network].USDT];
        break;
      }
      case 'AnteEthDevRugTest': {
        args = [constants.deployConsts[network].ETH_DEV];
        break;
      }
      default: {
        args = [];
        break;
      }
    }

    console.log(`Deploying test and pool for ${testName}`);
    await deployTestPoolAndRecord(hre, deployment, poolFactory, testName, args);
    saveDeployment(deploymentFile, deployment);
  }
};

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const deploymentFile = path.resolve(__dirname, `./deployments/${network}.json`);

  console.log(`Deploying all contracts to network ${network} from deployer ${deployer.address}`);

  let deployment: constants.Deployment;
  console.log(`Attempting to load existing deployment from file ${deploymentFile}`);
  try {
    deployment = loadDeployment(deploymentFile);
  } catch (e) {
    console.log(`no existing deployment found, initializing empty deployment...`);
    deployment = emptyDeployment();
  }

  const curCommitHash = currentCommitHash();
  if (deployment['commit'] != '' && deployment['commit'] != curCommitHash) {
    throw new Error('commit hash on existing deployment does not match repository commit hash');
  }
  deployment['commit'] = curCommitHash;

  if (!('AntePoolFactory' in deployment.contracts)) {
    console.log('AntePoolFactory not found, deploying...');
    await deployAndRecord(hre, deployment, 'AntePoolFactory', []);
    saveDeployment(deploymentFile, deployment);
  }

  const poolFactory = await hre.ethers.getContractAt(
    'AntePoolFactory',
    deployment.contracts['AntePoolFactory'].address
  );

  console.log('Deploying ante tests and pools');
  await deployLaunchTestsAndPools(poolFactory, deployment, network, deploymentFile);

  console.log(`Saving deployment`);
  saveDeployment(deploymentFile, deployment);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
