import { basicFixture, BasicFixture } from '../fixtures/basic.fixture';
import { evmSnapshot, evmRevert } from '../helpers';
import * as constants from '../constants';

import { Contract } from 'ethers';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

import { expect } from 'chai';

describe('Initial Conditions', function () {
  const wallets = provider.getWallets();
  const [staker, challenger] = wallets;

  let deployment: BasicFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pool: Contract;

  before(async () => {
    deployment = await loadFixture(basicFixture);
    globalSnapshotId = await evmSnapshot();
    snapshotId = await evmSnapshot();

    pool = deployment.oddBlockDeployment.pool;
  });

  after(async () => {
    await evmRevert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evmRevert(snapshotId);
    snapshotId = await evmSnapshot();
  });

  it('random user has 0 supporting balance', async function () {
    expect(await pool.getStoredBalance(staker.address, false)).to.be.equal(0);
  });

  it('random user has 0 challenging balance', async function () {
    expect(await pool.getStoredBalance(staker.address, true)).to.be.equal(0);
  });

  it('pendingFailure is false', async function () {
    expect(await pool.pendingFailure()).to.be.false;
  });

  it('verifier not set', async function () {
    expect(await pool.verifier()).to.equal('0x0000000000000000000000000000000000000000');
  });

  it('pool factory is set to AntePoolFactory address', async function () {
    expect(await pool.factory()).to.equal(deployment.poolFactory.address);
  });

  it('anteTest is set to ante test address', async () => {
    expect(await pool.anteTest()).to.equal(deployment.oddBlockDeployment.test.address);
  });

  it('poolSideInfo initialized properly for stakers', async function () {
    const stakingInfo = await pool.stakingInfo();
    expect(stakingInfo.numUsers).to.equal(0);
    expect(stakingInfo.totalAmount).to.equal(0);
    expect(stakingInfo.decayMultiplier).to.equal(constants.ONE_ETH);
  });

  it('poolSideInfo initialized properly for challengers', async function () {
    const challengerInfo = await pool.challengerInfo();
    expect(challengerInfo.numUsers).to.equal(0);
    expect(challengerInfo.totalAmount).to.equal(0);
    expect(challengerInfo.decayMultiplier).to.equal(constants.ONE_ETH);
  });

  it('checkTest and claim variables initialized properly', async () => {
    expect(await pool.numTimesVerified()).to.equal(0);
    expect(await pool.numPaidOut()).to.equal(0);
    expect(await pool.totalPaidOut()).to.equal(0);
    expect(await pool.lastVerifiedBlock()).to.equal(0);
    expect(await pool.failedBlock()).to.equal(0);
    expect(await pool.getVerifierBounty()).to.equal(0);
    expect(await pool.getTotalChallengerEligibleBalance()).to.equal(0);

    // no one has staked anything yet
    await expect(pool.getChallengerPayout(challenger.address)).to.be.reverted;
  });

  it('stake and unstake variables initialized properly', async () => {
    expect(await pool.getTotalStaked()).to.equal(0);
    expect(await pool.getTotalChallengerStaked()).to.equal(0);
    expect(await pool.getTotalPendingWithdraw()).to.equal(0);

    expect(await pool.getPendingWithdrawAmount(staker.address)).to.equal(0);
    await expect(pool.getPendingWithdrawAllowedTime(staker.address)).to.be.reverted;
  });
});
