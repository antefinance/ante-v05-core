import { revertingTestFixture, RevertingTestFixture } from '../fixtures/revertingTest.fixture';
import { evmSnapshot, evmRevert, blockNumber, getExpectedChallengerPayoutWithoutBounty } from '../helpers';
import * as constants from '../constants';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

import { expect } from 'chai';
import { AntePool, AnteRevertingTest } from '../../typechain';

describe('CheckTest', function () {
  const wallets = provider.getWallets();
  const [staker, challenger, staker_2, challenger_2, challenger_3] = wallets;

  let deployment: RevertingTestFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pool: AntePool;
  let test: AnteRevertingTest;

  before(async () => {
    deployment = await loadFixture(revertingTestFixture);
    globalSnapshotId = await evmSnapshot();
    snapshotId = await evmSnapshot();

    pool = deployment.revertingTestDeployment.pool;
    test = deployment.revertingTestDeployment.test as AnteRevertingTest;
  });

  after(async () => {
    await evmRevert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evmRevert(snapshotId);
    snapshotId = await evmSnapshot();
  });

  it('calling checkTest for passing test should not update pendingFailure to true', async () => {
    expect(await test.checkTestPasses()).to.be.true;
    await pool.connect(challenger).checkTest();

    expect(await pool.pendingFailure()).to.be.false;
  });

  it('challengers cannot claim if test has not failed', async () => {
    await expect(pool.connect(challenger).claim()).to.be.revertedWith('ANTE: Test has not failed');
  });

  it('calling claim before test failure does not transfer eth out of pool', async () => {
    const pool_balance = await provider.getBalance(pool.address);
    await expect(pool.connect(challenger).claim()).to.be.reverted;

    expect(await provider.getBalance(pool.address)).to.equal(pool_balance);
  });

  it('challenger cannot call checkTest within 12 blocks of staking', async () => {
    await expect(pool.connect(challenger_3).checkTest()).to.be.revertedWith(
      'ANTE: must wait 12 blocks after challenging to call checkTest'
    );
  });

  it('address which is not challenging cannot call checkTest', async () => {
    await expect(pool.connect(staker).checkTest()).to.be.revertedWith('ANTE: Only challengers can checkTest');
  });

  it('checkTest updates lastVerifiedBlock and numTimesVerified', async () => {
    const numTimesVerified = await pool.numTimesVerified();

    await pool.connect(challenger).checkTest();

    expect(await pool.lastVerifiedBlock()).to.equal(await blockNumber());
    expect(await pool.numTimesVerified()).to.equal(numTimesVerified.add(1));
  });

  //TODO: add explicit test that checkTest sets pendingFailure to true if checkTestPasses returns false? Already covered elsewhere in test suite

  it('checkTest sets pendingFailure to true if underlying ante test reverts on checkTestPasses', async () => {
    await test.setWillRevert(true);

    await pool.connect(challenger).checkTest();
    expect(await pool.pendingFailure()).to.be.true;
  });

  it('challenger payout estimated correctly prior to test failure', async () => {
    const expectedPayout = await getExpectedChallengerPayoutWithoutBounty(challenger, pool);
    expect(await pool.getChallengerPayout(challenger.address)).to.equal(expectedPayout);
  });

  it('TestChecked and FailureOccured events emit correctly', async () => {
    await expect(pool.connect(challenger).checkTest()).to.emit(pool, 'TestChecked').withArgs(challenger.address);

    await test.setWillRevert(true);

    await expect(pool.connect(challenger).checkTest()).to.emit(pool, 'FailureOccurred').withArgs(challenger.address);
  });
});
