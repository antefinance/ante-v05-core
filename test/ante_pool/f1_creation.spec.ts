import { basicFixture, BasicFixture } from '../fixtures/basic.fixture';
import { evmSnapshot, evmRevert } from '../helpers';
import AnteAlwaysFailTest from '../../artifacts/contracts/mock/AnteAlwaysFailTest.sol/AnteAlwaysFailTest.json';
import AnteInvalidTest from '../../artifacts/contracts/mock/AnteInvalidTest.sol/AnteInvalidTest.json';
import AntePool from '../../artifacts/contracts/AntePool.sol/AntePool.json';
import AnteAlwaysPassTest from '../../artifacts/contracts/mock/AnteAlwaysPassTest.sol/AnteAlwaysPassTest.json';

import { Contract } from 'ethers';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider, deployContract } = waffle;
import * as constants from '../constants';

import { expect } from 'chai';

describe('Cannot initialize pools with invalid ante tests', () => {
  const wallets = provider.getWallets();
  const [deployer, eoa] = wallets;

  let deployment: BasicFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let poolFactory: Contract;
  let uninitialized_pool: Contract;

  before(async () => {
    deployment = await loadFixture(basicFixture);

    // cannot create an uninitialized pool through pool factory
    uninitialized_pool = await deployContract(deployer, AntePool);

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

  it('initalization with EOA as ante test fails', async () => {
    await expect(poolFactory.createPool(eoa.address)).to.be.revertedWith('ANTE: AnteTest must be a smart contract');
  });

  it('initialization with not passing ante test fails', async () => {
    const alwaysFailTest = await deployContract(deployer, AnteAlwaysFailTest);

    await expect(poolFactory.createPool(alwaysFailTest.address)).to.be.revertedWith(
      'ANTE: AnteTest does not implement checkTestPasses or test fails'
    );
  });

  it("initialization with test contract that doesn't implement checkTestPasses fails", async () => {
    const invalidTest = await deployContract(deployer, AnteInvalidTest);

    await expect(poolFactory.createPool(invalidTest.address)).to.be.revertedWith(
      'ANTE: AnteTest does not implement checkTestPasses or test fails'
    );
  });

  it('uninitialized pools have pendingFailure set to true', async () => {
    expect(await uninitialized_pool.pendingFailure()).to.be.true;
  });

  it('users cannot stake/challenge/unstake/withdrawStake/cancelPendingWithdraw on uninitialized_pool', async () => {
    await expect(uninitialized_pool.connect(eoa).stake(false, { value: constants.ONE_ETH })).to.be.reverted;
    await expect(uninitialized_pool.connect(eoa).stake(true, { value: constants.ONE_ETH })).to.be.reverted;
    await expect(uninitialized_pool.connect(eoa).unstakeAll(false)).to.be.reverted;

    await expect(uninitialized_pool.connect(eoa).unstakeAll(true)).to.be.reverted;

    await expect(uninitialized_pool.connect(eoa).unstake(constants.ONE_ETH, false)).to.be.reverted;
    await expect(uninitialized_pool.connect(eoa).unstake(constants.ONE_ETH, true)).to.be.reverted;
    await expect(uninitialized_pool.connect(eoa).withdrawStake()).to.be.reverted;

    await expect(uninitialized_pool.connect(eoa).cancelPendingWithdraw()).to.be.reverted;
  });

  it('only factory can initialize pool', async () => {
    // sanity check
    expect(await uninitialized_pool.factory()).to.equal(deployer.address);

    await expect(
      uninitialized_pool.connect(eoa).initialize(deployment.oddBlockDeployment.test.address)
    ).to.be.revertedWith('ANTE: only factory can initialize AntePool');
  });

  it('pool can only be initialized once', async () => {
    const test = await deployContract(deployer, AnteAlwaysPassTest);
    await uninitialized_pool.connect(deployer).initialize(test.address);

    await expect(uninitialized_pool.connect(deployer).initialize(test.address)).to.be.revertedWith(
      'ANTE: Pool already initialized'
    );
  });
});
