import { basicFixture, BasicFixture } from '../fixtures/basic.fixture';
import { evmSnapshot, evmRevert } from '../helpers';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

import {
  AntePoolFactory,
  AnteInvalidTest__factory,
  AnteAlwaysFailTest__factory,
  AntePoolFactory__factory,
} from '../../typechain';

import { expect } from 'chai';

describe('Ante Pool Factory', function () {
  const wallets = provider.getWallets();
  const [deployer] = wallets;

  let deployment: BasicFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let poolFactory: AntePoolFactory;

  before(async () => {
    deployment = await loadFixture(basicFixture);
    globalSnapshotId = await evmSnapshot();
    snapshotId = await evmSnapshot();

    poolFactory = deployment.poolFactory;
  });

  after(async () => {
    await evmRevert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evmRevert(snapshotId);
    snapshotId = await evmSnapshot();
  });

  it('createPool should revert if trying to create a pool from an invalid ante test', async () => {
    const factory = (await hre.ethers.getContractFactory('AnteInvalidTest', deployer)) as AnteInvalidTest__factory;

    const testContract = await factory.deploy();
    await testContract.deployed();

    await expect(poolFactory.createPool(testContract.address)).to.be.revertedWith(
      'ANTE: AnteTest either does not implement checkTestPasses or test currently fails'
    );
  });

  it('createPool should revert if trying to create a pool from a currently failing ante test', async () => {
    const factory = (await hre.ethers.getContractFactory(
      'AnteAlwaysFailTest',
      deployer
    )) as AnteAlwaysFailTest__factory;

    const testContract = await factory.deploy();
    await testContract.deployed();

    await expect(poolFactory.createPool(testContract.address)).to.be.revertedWith(
      'ANTE: AnteTest either does not implement checkTestPasses or test currently fails'
    );
  });

  it('createPool should revert if trying to create a duplicate pool for an ante test', async () => {
    const { test } = deployment.oddBlockDeployment;
    await expect(poolFactory.createPool(test.address)).to.be.revertedWith('Ante: pool already created');
  });

  it('createPool updates allPools and poolMap correctly', async () => {
    const { pool, test } = deployment.oddBlockDeployment;

    // this is first test/pool created
    expect(await poolFactory.allPools(0)).to.equal(pool.address);
    expect(await poolFactory.poolMap(test.address)).to.equal(pool.address);
  });
});
