import chalk from 'chalk';
import { Contract } from 'ethers';

export interface TestPoolDeployment {
  test: Contract;
  pool: Contract;
}

export async function deployContract(hre: any, contractName: string, args: any[]): Promise<Contract> {
  const [deployer] = await hre.ethers.getSigners();

  console.log('Deploying contract ', chalk.red(contractName), 'from deployer ', chalk.magenta(deployer.address));

  let factory = await hre.ethers.getContractFactory(contractName);

  const contract = await factory.deploy(...args);
  await contract.deployed();

  console.log('Contract deployed to', chalk.magenta(contract.address));

  return contract;
}

export async function deployTestAndPool(
  hre: any,
  poolFactory: Contract,
  testContractName: string,
  testArgs: any[]
): Promise<TestPoolDeployment> {
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
