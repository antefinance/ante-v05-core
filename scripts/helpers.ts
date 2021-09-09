import chalk from 'chalk';
import fs from 'fs';
import child_process from 'child_process';

import { Contract } from 'ethers';

import * as constants from './constants';

export async function deployTestPoolAndRecord(
  hre: any,
  deployment: constants.Deployment,
  poolFactory: Contract,
  testName: string,
  args: any[]
): Promise<void> {
  const testContract = await deployContract(hre, testName, args);

  const tx = await poolFactory.createPool(testContract.address);
  const receipt = await tx.wait();

  const poolAddr = receipt.events[0].args['testPool'];

  deployment.testPools[testName] = {
    test: {
      address: testContract.address,
      tx: testContract.deployTransaction.hash,
      args: args,
    },
    pool: {
      address: poolAddr,
      tx: receipt.transactionHash,
      args: [],
    },
  };
}

export async function deployAndRecord(
  hre: any,
  deployment: constants.Deployment,
  contractName: string,
  args: any[]
): Promise<void> {
  const deployedContract = await deployContract(hre, contractName, args);

  deployment.contracts[contractName] = {
    address: deployedContract.address,
    tx: deployedContract.deployTransaction.hash,
    args: args,
  };
}

export async function deployContract(hre: any, contractName: string, args: any[]): Promise<Contract> {
  const [deployer] = await hre.ethers.getSigners();

  console.log('Deploying contract ', chalk.red(contractName), 'from deployer ', chalk.magenta(deployer.address));

  const factory = await hre.ethers.getContractFactory(contractName);

  const contract = await factory.deploy(...args);
  await contract.deployed();

  console.log('Contract deployed to', chalk.magenta(contract.address));

  return contract;
}

// this function is used for mock deployments
export async function deployTestAndPool(
  hre: any,
  poolFactory: Contract,
  testContractName: string,
  testArgs: any[]
): Promise<constants.TestPoolDeployment> {
  const testContract = await deployContract(hre, testContractName, testArgs);

  const tx = await poolFactory.createPool(testContract.address);
  const receipt = await tx.wait();

  const poolContract = await hre.ethers.getContractAt('AntePool', receipt.events[0].args['testPool']);

  console.log('Pool contract deployed to', chalk.magenta(poolContract.address));
  return {
    test: testContract,
    pool: poolContract,
  };
}

export async function mineBlocks(hre: any, numBlocks: number): Promise<any> {
  for (let i = 0; i < numBlocks; i++) {
    await hre.network.provider.send('evm_mine');
  }
}

export function emptyDeployment(): constants.Deployment {
  return {
    commit: '',
    timestamp: 0,
    contracts: {},
    testPools: {},
  };
}

export function loadDeployment(file: string): constants.Deployment {
  const deployment = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return deployment as constants.Deployment;
}

export function saveDeployment(file: string, deployment: constants.Deployment): void {
  deployment['timestamp'] = new Date().getTime();
  fs.writeFileSync(file, JSON.stringify(deployment, null, '  '), 'utf8');
}

export function currentCommitHash(): string {
  return child_process.execSync('git rev-parse HEAD').toString().trim();
}
