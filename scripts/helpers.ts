import chalk from 'chalk';

export interface TestPoolDeployment {
  test: any;
  pool: any;
}

export async function deployContract(hre: any, contractName: string, args: any[]): Promise<any> {
  const [deployer] = await hre.ethers.getSigners();

  console.log('Deploying contract ', chalk.red(contractName), 'from deployer ', chalk.magenta(deployer.address));

  let factory = await hre.ethers.getContractFactory(contractName);

  const contract = await factory.deploy(...args);
  await contract.deployed();

  console.log('Contract deployed to', chalk.magenta(contract.address));

  return contract;
}

export async function deployTestAndPool(hre: any, testContractName: string, testArgs: any[]): Promise<any> {
  const testContract = await deployContract(hre, testContractName, testArgs);
  const testName = await testContract.testName();

  const poolContract = await deployContract(hre, 'AntePool', [testContract.address, testName]);

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
