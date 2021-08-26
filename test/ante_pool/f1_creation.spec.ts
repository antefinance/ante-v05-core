import { basicFixture, BasicFixture } from '../fixtures/basic.fixture';
import { evmSnapshot, evmRevert } from '../helpers';
import AnteAlwaysFailTest from '../../artifacts/contracts/mock/AnteAlwaysFailTest.sol/AnteAlwaysFailTest.json';
import AnteInvalidTest from '../../artifacts/contracts/mock/AnteInvalidTest.sol/AnteInvalidTest.json';

import { Contract } from 'ethers';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider, deployContract } = waffle;

import { expect } from 'chai';

describe('Cannot initialize pools with invalid ante tests', () => {
  const wallets = provider.getWallets();
  const [deployer, eoa] = wallets;

  let deployment: BasicFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let poolFactory: Contract;

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

  it('initalization with EOA as ante test fails', async () => {
    await expect(poolFactory.createPool(eoa.address)).to.be.revertedWith('ANTE: AnteTest must be a smart contract');
  });

  it('initialization with not passing ante test fails', async () => {
    const alwaysFailTest = await deployContract(deployer, AnteAlwaysFailTest);

    await expect(poolFactory.createPool(alwaysFailTest.address)).to.be.revertedWith(
      'ANTE: AnteTest either does not implement checkTestPasses or test currently fails'
    );
  });

  it("initialization with test contract that doesn't implement checkTestPasses fails", async () => {
    const invalidTest = await deployContract(deployer, AnteInvalidTest);

    await expect(poolFactory.createPool(invalidTest.address)).to.be.revertedWith(
      'ANTE: AnteTest either does not implement checkTestPasses or test currently fails'
    );
  });
});
