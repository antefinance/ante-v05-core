import { failedTestFixture } from '../fixtures/failedTest.fixture';
import { RevertingTestFixture } from '../fixtures/revertingTest.fixture';
import {
  evmSnapshot,
  evmRevert,
  evmMineBlocks,
  blockNumber,
  getExpectedChallengerPayoutWithoutBounty,
  calculateGasUsed,
} from '../helpers';
import * as constants from '../constants';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

import { expect } from 'chai';
import { AntePool } from '../../typechain';

describe('Claim', function () {
  const wallets = provider.getWallets();
  const [staker, challenger, staker_2, challenger_2, challenger_3] = wallets;

  let deployment: RevertingTestFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pool: AntePool;

  before(async () => {
    // note: failure on this test has already been triggered by challenger
    // challenger_3 is ineligible for payout of staker balances on claim
    // staker has their entire balance pending withdraw
    deployment = await loadFixture(failedTestFixture);
    globalSnapshotId = await evmSnapshot();
    snapshotId = await evmSnapshot();

    pool = deployment.revertingTestDeployment.pool;
  });

  after(async () => {
    await evmRevert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evmRevert(snapshotId);
    snapshotId = await evmSnapshot();
  });

  it('staker, challenger, and pendingWithdraw balances do not change after test failure', async () => {
    const totalPendingWithdraw = await pool.getTotalPendingWithdraw();
    const totalStaked = await pool.getTotalStaked();
    const totalChallenged = await pool.getTotalChallengerStaked();

    const stakerTwoBal = await pool.getStoredBalance(staker_2.address, false);
    const challengerBal = await pool.getStoredBalance(challenger.address, true);
    const stakerOnePendingWithdraw = await pool.getPendingWithdrawAmount(staker.address);

    await evmMineBlocks(10);

    expect(await pool.getTotalPendingWithdraw()).to.equal(totalPendingWithdraw);
    expect(await pool.getTotalStaked()).to.equal(totalStaked);
    expect(await pool.getTotalChallengerStaked()).to.equal(totalChallenged);
    expect(await pool.getStoredBalance(staker_2.address, false)).to.equal(stakerTwoBal);
    expect(await pool.getStoredBalance(challenger.address, true)).to.equal(challengerBal);
    expect(await pool.getPendingWithdrawAmount(staker.address)).to.equal(stakerOnePendingWithdraw);
  });

  it('verifierBounty calculated properly', async () => {
    const totalAmount = (await pool.getTotalStaked()).add(await pool.getTotalPendingWithdraw());

    const bounty = totalAmount.mul(constants.VERIFIER_BOUNTY_PCT).div(100);
    expect(await pool.getVerifierBounty()).to.equal(bounty);
  });

  it('test failure updates pendingFailure, lastVerifiedBlock, verifer, and failedBlock correctly', async () => {
    // test is already failed

    const lastBlock = await blockNumber();
    expect(await pool.pendingFailure()).to.be.true;
    expect(await pool.lastVerifiedBlock()).to.equal(lastBlock);
    expect(await pool.failedBlock()).to.equal(lastBlock);
    expect(await pool.verifier()).to.equal(challenger.address);
  });

  it('test failure updates totalChallengerEligibleBalance correctly', async () => {
    const challengerOneBalance = await pool.getStoredBalance(challenger.address, true);
    const challengerTwoBalance = await pool.getStoredBalance(challenger_2.address, true);
    expect(await pool.getTotalChallengerEligibleBalance()).to.equal(challengerOneBalance.add(challengerTwoBalance));
  });

  it('users cannot stake/challenge/unstake/withdrawStake/cancelPendingWithdraw on test failure', async () => {
    await expect(pool.connect(staker).stake(false, { value: constants.ONE_ETH })).to.be.revertedWith(
      'ANTE: Test already failed.'
    );

    await expect(pool.connect(challenger).stake(true, { value: constants.ONE_ETH })).to.be.revertedWith(
      'ANTE: Test already failed.'
    );

    await expect(pool.connect(staker_2).unstakeAll(false)).to.be.revertedWith('ANTE: Test already failed.');

    await expect(pool.connect(challenger).unstakeAll(true)).to.be.revertedWith('ANTE: Test already failed.');

    await expect(pool.connect(staker_2).unstake(constants.ONE_ETH, false)).to.be.revertedWith(
      'ANTE: Test already failed.'
    );

    await expect(pool.connect(challenger).unstake(constants.ONE_ETH, true)).to.be.revertedWith(
      'ANTE: Test already failed.'
    );

    await expect(pool.connect(staker).withdrawStake()).to.be.revertedWith('ANTE: Test already failed.');

    await expect(pool.connect(staker).cancelPendingWithdraw()).to.be.revertedWith('ANTE: Test already failed.');
  });

  it('challengers payout on claim calculated correctly for eligible challenger', async () => {
    const expectedPayout = await getExpectedChallengerPayoutWithoutBounty(challenger_2, pool);
    expect(await pool.getChallengerPayout(challenger_2.address)).to.equal(expectedPayout);
  });

  it('challengers payout on claim calculated correctly for verifier', async () => {
    const expectedPayout = await getExpectedChallengerPayoutWithoutBounty(challenger, pool);
    const bounty = await pool.getVerifierBounty();

    expect(await pool.getChallengerPayout(challenger.address)).to.equal(expectedPayout.add(bounty));
  });

  it('challenger payout calculated correctly for ineligible challenger', async () => {
    // expected payout is just challenger balance for ineligible challenger
    const expectedPayout = await pool.getStoredBalance(challenger_3.address, true);

    expect(await pool.getChallengerPayout(challenger_3.address)).to.equal(expectedPayout);
  });

  it('transfers correct amount of eth out of pool on successful claim for all challengers', async () => {
    // check verifier, eligible challenger, and ineligible challenger
    const pool_balance = await provider.getBalance(pool.address);
    const challengerOneBalance = await challenger.getBalance();
    const challengerTwoBalance = await challenger_2.getBalance();
    const challengerThreeBalance = await challenger_3.getBalance();

    // sanity check
    expect(await provider.getBalance(pool.address)).to.be.gt(constants.TWO_ETH);

    // checked that these values are accurate in other tests, so can trust them here
    const challengerOnePayout = await pool.getChallengerPayout(challenger.address);
    const challengerTwoPayout = await pool.getChallengerPayout(challenger_2.address);
    const challengerThreePayout = await pool.getChallengerPayout(challenger_3.address);

    let txpromise = await pool.connect(challenger).claim();
    let gasCost = await calculateGasUsed(txpromise);

    expect(await provider.getBalance(pool.address)).to.equal(pool_balance.sub(challengerOnePayout));
    expect(await challenger.getBalance()).to.equal(challengerOneBalance.add(challengerOnePayout).sub(gasCost));

    txpromise = await pool.connect(challenger_2).claim();
    gasCost = await calculateGasUsed(txpromise);

    expect(await provider.getBalance(pool.address)).to.equal(
      pool_balance.sub(challengerOnePayout).sub(challengerTwoPayout)
    );
    expect(await challenger_2.getBalance()).to.equal(challengerTwoBalance.add(challengerTwoPayout).sub(gasCost));

    txpromise = await pool.connect(challenger_3).claim();
    gasCost = await calculateGasUsed(txpromise);

    expect(await provider.getBalance(pool.address)).to.equal(
      pool_balance.sub(challengerOnePayout).sub(challengerTwoPayout).sub(challengerThreePayout)
    );
    expect(await challenger_3.getBalance()).to.equal(challengerThreeBalance.add(challengerThreePayout).sub(gasCost));

    // sanity check, some wei ok to be left in pool bc of rounding errors
    expect(await provider.getBalance(pool.address)).to.be.lt(1000);
  });

  it('claim updates numPaidOut, totalPaidOut', async () => {
    const payout = await pool.getChallengerPayout(challenger_2.address);
    const totalPaidOut = await pool.totalPaidOut();
    const numPaidOut = await pool.numPaidOut();

    await pool.connect(challenger_2).claim();

    expect(await pool.totalPaidOut()).to.equal(totalPaidOut.add(payout));
    expect(await pool.numPaidOut()).to.equal(numPaidOut.add(1));
  });

  it('challengers cannot claim multiple times', async () => {
    await pool.connect(challenger).claim();

    await expect(pool.connect(challenger).claim()).to.be.revertedWith('ANTE: No Challenger Staking balance');
  });

  it('address which is not challenging cannot claim', async () => {
    await expect(pool.connect(staker).claim()).to.be.revertedWith('ANTE: No Challenger Staking balance');
  });
});
