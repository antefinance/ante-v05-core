import { BasicFixture } from '../fixtures/basic.fixture';
import { oneSupportChallengeFixture } from '../fixtures/oneSupportChallenge.fixture';
import {
  evmSnapshot,
  evmRevert,
  calculateGasUsed,
  calculateDecay,
  getExpectedStakerBalance,
  getExpectedChallengerBalance,
  expectAlmostEqual,
  blockTimestamp,
} from '../helpers';

import * as constants from '../constants';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

import { expect } from 'chai';
import { AntePool } from '../../typechain';

describe('Unstake and UnstakeAll', function () {
  const wallets = provider.getWallets();
  const [staker, challenger, staker_2, challenger_2] = wallets;

  let deployment: BasicFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pool: AntePool;

  before(async () => {
    deployment = await loadFixture(oneSupportChallengeFixture);
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

  it('getTotalStaked, numusers, and getTotalPendingWithdraw updates properly on unstake', async () => {
    const stakingInfo = await pool.stakingInfo();

    expect(await pool.getTotalStaked()).to.equal(constants.ONE_ETH);

    // one block of decay accrues
    await pool.connect(challenger).unstakeAll(true);
    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers);
    expect(await pool.getTotalStaked()).to.equal(constants.ONE_ETH.add(constants.ONE_BLOCK_DECAY));

    await pool.connect(staker).unstake(constants.HALF_ETH, false);
    expect(await pool.getTotalStaked()).to.equal(constants.HALF_ETH.add(constants.ONE_BLOCK_DECAY));
    expect(await pool.getTotalPendingWithdraw()).to.equal(constants.HALF_ETH);

    await pool.connect(staker).unstake(constants.ONE_ETH.div(4), false);
    expect(await pool.getTotalStaked()).to.equal(constants.ONE_ETH.div(4).add(constants.ONE_BLOCK_DECAY));
    expect(await pool.getTotalPendingWithdraw()).to.equal(constants.HALF_ETH.add(constants.ONE_ETH.div(4)));

    // didn't unstake entire staker balance
    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers);
  });

  it('getTotalStaked, numUsers, and getTotalPendingWithdraw update properly on unstakeAll', async () => {
    await pool.connect(staker_2).stake(false, { value: constants.ONE_ETH });
    const expectedSupporterTwoBalance = await getExpectedStakerBalance(staker_2, pool, 1);
    const expectedSupporterOneBalance = await getExpectedStakerBalance(staker, pool, 1);
    const stakingInfo = await pool.stakingInfo();
    await pool.connect(staker).unstakeAll(false);

    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers.sub(1));
    expect(await pool.getTotalPendingWithdraw()).to.equal(expectedSupporterOneBalance);
    expectAlmostEqual(await pool.getTotalStaked(), expectedSupporterTwoBalance, 2);
  });

  it('getTotalChallengerStaked and numUsers updates properly on unstake challenge', async () => {
    expect(await pool.getTotalChallengerStaked()).to.equal(constants.ONE_ETH);
    const challengerInfo = await pool.challengerInfo();

    // one block of decay accrues
    await pool.connect(staker).unstakeAll(false);
    expect(await pool.getTotalChallengerStaked()).to.equal(constants.ONE_ETH.sub(constants.ONE_BLOCK_DECAY));

    await pool.connect(challenger).unstake(constants.ONE_ETH.div(2), true);
    expect(await pool.getTotalChallengerStaked()).to.equal(constants.ONE_ETH.div(2).sub(constants.ONE_BLOCK_DECAY));

    await pool.connect(challenger).unstake(constants.ONE_ETH.div(4), true);
    expect(await pool.getTotalChallengerStaked()).to.equal(constants.ONE_ETH.div(4).sub(constants.ONE_BLOCK_DECAY));

    // didnt unstake full challengers balance
    expect((await pool.challengerInfo()).numUsers).to.equal(challengerInfo.numUsers);
  });

  it('should update user stored balance, pendingWithdrawAmount, and pendingWithdrawAllowedTime correctly on unstake', async () => {
    const staker_balance = await pool.getStoredBalance(staker.address, false);

    await pool.connect(staker).unstake(constants.HALF_ETH, false);
    const timestamp = await blockTimestamp();
    // make sure user balances are correct
    expect(await pool.getStoredBalance(staker.address, false)).to.be.equal(
      staker_balance.sub(constants.HALF_ETH).add(constants.ONE_BLOCK_DECAY)
    );
    expect(await pool.getStoredBalance(staker.address, true)).to.be.equal(0);

    expect(await pool.getPendingWithdrawAmount(staker.address)).to.be.equal(constants.HALF_ETH);

    expect(await pool.getPendingWithdrawAllowedTime(staker.address)).to.equal(timestamp + constants.ONE_DAY_IN_SECONDS);
  });

  it('should update user stored balance, pendingWithdrawAmount, and pendingWithdrawAllowedTime correctly on unstakeAll', async () => {
    const staker_balance = await pool.getStoredBalance(staker.address, false);

    await pool.connect(staker).unstakeAll(false);
    const timestamp = await blockTimestamp();
    // make sure user balances are correct
    expect(await pool.getStoredBalance(staker.address, false)).to.be.equal(0);
    expect(await pool.getStoredBalance(staker.address, true)).to.be.equal(0);

    expect(await pool.getPendingWithdrawAmount(staker.address)).to.be.equal(
      staker_balance.add(constants.ONE_BLOCK_DECAY)
    );

    expect(await pool.getPendingWithdrawAllowedTime(staker.address)).to.equal(timestamp + constants.ONE_DAY_IN_SECONDS);
  });

  it('should update user stored balance correctly on unstake challenge', async () => {
    const challenger_balance = await pool.getStoredBalance(challenger.address, true);

    await pool.connect(challenger).unstakeAll(true);
    // make sure user balances are correct
    expect(await pool.getStoredBalance(challenger.address, true)).to.be.equal(0);
    expect(await pool.getStoredBalance(challenger.address, false)).to.be.equal(0);
  });

  it('should update user stored balance correctly on unstakeAll challenge', async () => {
    const challenger_balance = await pool.getStoredBalance(challenger.address, true);

    await pool.connect(challenger).unstakeAll(true);
    // make sure user balances are correct
    expect(await pool.getStoredBalance(challenger.address, true)).to.be.equal(0);
    expect(await pool.getStoredBalance(challenger.address, false)).to.be.equal(0);
  });

  it('user cannot unstake more than they have staked', async () => {
    await expect(pool.connect(staker).unstake(constants.ONE_ETH.mul(101).div(100), false)).to.be.reverted;
    await expect(pool.connect(challenger).unstake(constants.ONE_ETH.mul(101).div(100), true)).to.be.reverted;
  });

  it('user cannot unstakeAll the same stake twice', async () => {
    await pool.connect(staker).unstakeAll(false);
    await expect(pool.connect(staker).unstakeAll(false)).to.be.reverted;

    await pool.connect(challenger).unstakeAll(true);
    await expect(pool.connect(challenger).unstakeAll(true)).to.be.reverted;
  });

  it('getTotalChallengerStaked, getTotalPendingWithdraw, and numUsers update properly on unstakeAll challenger', async () => {
    await pool.connect(challenger_2).stake(true, { value: constants.ONE_ETH });
    const expectedChallengerTwoBalance = await getExpectedChallengerBalance(challenger_2, pool, 1);
    await pool.connect(challenger).unstakeAll(true);

    expect(await pool.getTotalChallengerStaked()).to.equal(expectedChallengerTwoBalance);
  });

  it('should not transfer ETH when initiating withdraw of staker position', async () => {
    const staker_balance = await staker.getBalance();
    const pool_balance = await provider.getBalance(pool.address);

    const txpromise = await pool.connect(staker).unstake(constants.ONE_ETH, false);
    const gasCost = await calculateGasUsed(txpromise);

    expect(await staker.getBalance()).to.equal(staker_balance.sub(gasCost));
  });

  it('should not transfer ETH out of pool on unstakeAll', async () => {
    const staker_wallet_balance = await staker.getBalance();
    const pool_balance = await provider.getBalance(pool.address);

    const txpromise = await pool.connect(staker).unstakeAll(false);
    const gasCost = await calculateGasUsed(txpromise);

    expect(await staker.getBalance()).to.equal(staker_wallet_balance.sub(gasCost));

    expect(await provider.getBalance(pool.address)).to.equal(pool_balance);
  });

  it('should transfer ETH on unstakeAll challenge', async () => {
    const challenger_balance = await pool.getStoredBalance(challenger.address, true);
    const challenger_wallet_balance = await challenger.getBalance();
    const pool_balance = await provider.getBalance(pool.address);

    const expected_unstake_amount = challenger_balance.sub(constants.ONE_BLOCK_DECAY);

    const txpromise = await pool.connect(challenger).unstakeAll(true);
    const gasCost = await calculateGasUsed(txpromise);

    expect(await challenger.getBalance()).to.equal(challenger_wallet_balance.add(expected_unstake_amount).sub(gasCost));

    expect(await provider.getBalance(pool.address)).to.equal(pool_balance.sub(expected_unstake_amount));
  });

  it('should transfer ETH when withdrawing challenger position', async () => {
    const challenger_balance = await challenger.getBalance();

    const txpromise = await pool.connect(challenger).unstake(constants.ONE_ETH.div(2), true);
    const gasCost = await calculateGasUsed(txpromise);

    expect(await challenger.getBalance()).to.equal(challenger_balance.add(constants.ONE_ETH.div(2).sub(gasCost)));
  });

  it('should emit unstake event on unstake with proper args', async () => {
    await expect(pool.connect(staker).unstake(constants.HALF_ETH, false))
      .to.emit(pool, 'Unstake')
      .withArgs(staker.address, constants.HALF_ETH, false);
  });

  it('should emit unstake event on unstake challenge with proper args', async () => {
    await expect(pool.connect(challenger).unstake(constants.HALF_ETH, true))
      .to.emit(pool, 'Unstake')
      .withArgs(challenger.address, constants.HALF_ETH, true);
  });
});
