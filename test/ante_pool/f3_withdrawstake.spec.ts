import * as constants from '../constants';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;
import { withdrawableStakeFixture } from '../fixtures/withdrawableStake.fixture';
import { BasicFixture } from '../fixtures/basic.fixture';
import {
  evmSnapshot,
  evmRevert,
  calculateGasUsed,
  calculateDecay,
  getExpectedStakerBalance,
  getExpectedChallengerBalance,
  expectAlmostEqual,
  blockTimestamp,
  evmIncreaseTime,
} from '../helpers';

import { expect } from 'chai';
import { AntePool } from '../../typechain';

describe('Withdraw Stake and Cancel Withdraw', () => {
  const wallets = provider.getWallets();
  const [staker, challenger, staker_2, challenger_2] = wallets;

  let deployment: BasicFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pool: AntePool;

  before(async () => {
    deployment = await loadFixture(withdrawableStakeFixture);
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

  it('withdrawStake updates getTotalPendingWithdraw correctly and leaves getTotalStaked unchanged', async () => {
    expect(await pool.getTotalPendingWithdraw()).to.equal(constants.HALF_ETH);
    const total_staked = await pool.getTotalStaked();

    await pool.connect(staker).withdrawStake();

    expect(await pool.getTotalPendingWithdraw()).to.equal(0);
    expect(await pool.getTotalStaked()).to.equal(total_staked);
  });

  it('withdrawStake updates user pendingWithdrawAmount and leaves getStoredBalance unchanged', async () => {
    expect(await pool.getPendingWithdrawAmount(staker.address)).to.equal(constants.HALF_ETH);
    const expectedSupporterBalance = await getExpectedStakerBalance(staker, pool, 1);

    await pool.connect(staker).withdrawStake();

    expect(await pool.getPendingWithdrawAmount(staker.address)).to.equal(0);
    expectAlmostEqual(await pool.getStoredBalance(staker.address, false), expectedSupporterBalance, 2);
  });

  it('should not allow user to withdrawStake before withdraw window has passed', async () => {
    await pool.connect(staker_2).stake(false, { value: constants.ONE_ETH });
    await pool.connect(staker_2).unstakeAll(false);

    await evmIncreaseTime(constants.ONE_DAY_IN_SECONDS * 0.99);

    await expect(pool.connect(staker_2).withdrawStake()).to.be.revertedWith(
      'ANTE: must wait 24 hours to withdraw stake'
    );
  });

  it('should not allow user to withdraw the same stake multiple times', async () => {
    await pool.connect(staker).withdrawStake();

    await expect(pool.connect(staker).withdrawStake()).to.be.reverted;
  });

  it('should withdraw eth to wallet on successful withdrawStake call', async () => {
    const staker_wallet_balance = await staker.getBalance();
    const pool_balance = await provider.getBalance(pool.address);

    const txpromise = await pool.connect(staker).withdrawStake();
    const gasCost = await calculateGasUsed(txpromise);

    expect(await staker.getBalance()).to.equal(staker_wallet_balance.sub(gasCost).add(constants.HALF_ETH));
    expect(await provider.getBalance(pool.address)).to.equal(pool_balance.sub(constants.HALF_ETH));
  });

  it('should emit WithdrawStake event on successful withdraw with correct args', async () => {
    await expect(pool.connect(staker).withdrawStake())
      .to.emit(pool, 'WithdrawStake')
      .withArgs(staker.address, constants.HALF_ETH);
  });

  it('should reset the withdraw timer on subsequent unstake calls', async () => {
    await pool.connect(staker).unstake(constants.HALF_ETH, false);

    const timestamp = await blockTimestamp();
    expect(await pool.getPendingWithdrawAllowedTime(staker.address)).to.equal(timestamp + constants.ONE_DAY_IN_SECONDS);
  });

  it('cancelPendingWithdraw does not transfer eth out of pool', async () => {
    const pool_balance = await provider.getBalance(pool.address);

    await pool.connect(staker).cancelPendingWithdraw();

    expect(await provider.getBalance(pool.address)).to.equal(pool_balance);
  });

  it('cancelPendingWithdraw updates getTotalStaked, getTotalPendingWithdraw, and numUsers correctly', async () => {
    const expectedSupporterBalance = await getExpectedStakerBalance(staker, pool, 1);
    const stakingInfo = await pool.stakingInfo();

    expect(await pool.getTotalPendingWithdraw()).to.equal(constants.HALF_ETH);

    await pool.cancelPendingWithdraw();

    // didn't unstake full amount
    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers);
    expect(await pool.getTotalStaked()).to.equal(expectedSupporterBalance.add(constants.HALF_ETH));
    expect(await pool.getTotalPendingWithdraw()).to.equal(0);

    // stake and unstake a second user to make sure numUsers updates
    await pool.connect(staker_2).stake(false, { value: constants.ONE_ETH });
    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers.add(1));
    await pool.connect(staker_2).unstakeAll(false);
    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers);
    await pool.connect(staker_2).cancelPendingWithdraw();
    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers.add(1));
  });

  it('cancelPendingWithdraw updates user balance and pendingWithdraw amount correctly', async () => {
    const expectedSupporterBalance = await getExpectedStakerBalance(staker, pool, 1);
    expect(await pool.getPendingWithdrawAmount(staker.address)).to.equal(constants.HALF_ETH);

    await pool.connect(staker).cancelPendingWithdraw();

    expectAlmostEqual(
      await pool.getStoredBalance(staker.address, false),
      expectedSupporterBalance.add(constants.HALF_ETH),
      2
    );
    expect(await pool.getPendingWithdrawAmount(staker.address)).to.equal(0);
  });

  it('initiating unstake after cancelPendingWithdraw resets 24 hour withdrawal timer', async () => {
    await pool.connect(staker).cancelPendingWithdraw();
    await pool.connect(staker).unstakeAll(false);
    const timestamp = await blockTimestamp();
    expect(await pool.getPendingWithdrawAllowedTime(staker.address)).to.equal(timestamp + constants.ONE_DAY_IN_SECONDS);
  });

  it('cannot withdrawStake after cancelPendingWithdraw', async () => {
    await pool.connect(staker).cancelPendingWithdraw();

    await expect(pool.connect(staker).cancelPendingWithdraw()).to.be.revertedWith('ANTE: No pending withdraw balance');
  });

  it('cancelPendingWithdraw for wallet with no withdrawable stake reverts', async () => {
    await expect(pool.connect(staker_2).cancelPendingWithdraw()).to.be.revertedWith(
      'ANTE: No pending withdraw balance'
    );
  });

  it('cancelPendingWithdraw emits CancelWithdraw event with correct args', async () => {
    await expect(pool.connect(staker).cancelPendingWithdraw())
      .to.emit(pool, 'CancelWithdraw')
      .withArgs(staker.address, constants.HALF_ETH);
  });
});
