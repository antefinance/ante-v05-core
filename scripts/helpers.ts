import chalk from 'chalk';
import fs from 'fs';
import child_process from 'child_process';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, BigNumber } from 'ethers';

import * as constants from './constants';

export async function deployTestPoolAndRecord(
  hre: any,
  deployment: constants.Deployment,
  poolFactory: Contract,
  testName: string,
  args: any[]
): Promise<void> {
  const testContract = await deployContract(hre, testName, args);

  // wait 10 seconds for infura nodes to sync
  await delay(10000);
  const tx = await poolFactory.createPool(testContract.address, constants.deployConsts[hre.network.name]['OVERRIDES']);
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

  const contract = await factory.deploy(...args.concat(constants.deployConsts[hre.network.name]['OVERRIDES']));
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

export async function blockNumber(signer: SignerWithAddress): Promise<number> {
  // @ts-ignore
  return (await signer.provider.getBlock('latest')).number;
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

export async function calculateGasUsed(txpromise: any): Promise<BigNumber> {
  const txreceipt = await txpromise.wait();
  return txreceipt.effectiveGasPrice.mul(txreceipt.cumulativeGasUsed);
}

export async function distributeETH(
  amount: BigNumber,
  from_address: SignerWithAddress,
  to_addresses: SignerWithAddress[]
): Promise<void> {
  for (const receiver of to_addresses) {
    const balance = await receiver.getBalance();
    // only send if the account needs balance
    if (balance.eq(0)) {
      console.log(`Sending ${amount} wei from ${from_address.address} to ${receiver.address}`);
      const txpromise = await from_address.sendTransaction({
        to: receiver.address,
        value: amount,
      });
      await txpromise.wait();
    }
  }
}

export function delay(ms: number): any {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomNumber(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
