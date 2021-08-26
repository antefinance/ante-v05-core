import { Contract, providers, Wallet } from 'ethers';

import { AntePoolFactory, AntePoolFactory__factory, AnteOddBlockTest__factory } from '../../typechain';
import { deployTestAndPool } from '../helpers';
import * as constants from '../constants';

import hre from 'hardhat';
const { waffle } = hre;
//const { deployContract } = waffle;

export interface BasicFixture {
  poolFactory: AntePoolFactory;
  oddBlockDeployment: constants.TestPoolDeployment;
}

export async function basicFixture(w: Wallet[], p: providers.Web3Provider): Promise<BasicFixture> {
  const [deployer] = waffle.provider.getWallets();

  const factory = (await hre.ethers.getContractFactory('AntePoolFactory', deployer)) as AntePoolFactory__factory;
  const poolFactory: AntePoolFactory = await factory.deploy();
  await poolFactory.deployed();

  const oddBlockFactory = (await hre.ethers.getContractFactory(
    'AnteOddBlockTest',
    deployer
  )) as AnteOddBlockTest__factory;
  const oddBlockDeployment = await deployTestAndPool(deployer, poolFactory, oddBlockFactory, []);

  await oddBlockDeployment.test.setWillTest(true);

  return {
    poolFactory,
    oddBlockDeployment,
  };
}
