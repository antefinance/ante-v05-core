import { basicFixture, BasicFixture } from '../fixtures/basic.fixture';
import { evmSnapshot, evmRevert, calculateGasUsed, blockNumber } from '../helpers';

import { Contract } from 'ethers';

import * as constants from '../constants';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

import { expect } from 'chai';

describe('Stake Support and Stake Challenge', function () {
  const wallets = provider.getWallets();
  const [staker, challenger, staker_2, challenger_2] = wallets;

  let deployment: BasicFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let localSnapshotId: string;
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

  describe('getStoredBalance works', () => {
    before(async () => {
      localSnapshotId = await evmSnapshot();
    });

    beforeEach(async () => {
      await evmRevert(localSnapshotId);
      localSnapshotId = await evmSnapshot();
    });

    it('getStoredBalance updates properly on stake support', async () => {
      expect(await pool.getStoredBalance(staker.address, false)).to.be.equal(0);

      await pool.connect(staker).stake(false, { value: constants.ONE_ETH });

      expect(await pool.getStoredBalance(staker.address, false)).to.be.equal(constants.ONE_ETH);
      expect(await pool.getStoredBalance(challenger.address, false)).to.be.equal(0);
      expect(await pool.getStoredBalance(staker.address, true)).to.be.equal(0);

      await pool.connect(staker).stake(false, { value: constants.TWO_ETH });

      expect(await pool.getStoredBalance(staker.address, false)).to.be.equal(constants.ONE_ETH.mul(3));
      expect(await pool.getStoredBalance(challenger.address, false)).to.be.equal(0);
      expect(await pool.getStoredBalance(staker.address, true)).to.be.equal(0);
    });

    it('getStoredBalance updates properly on stake challenge', async () => {
      expect(await pool.getStoredBalance(challenger.address, true)).to.be.equal(0);

      await pool.connect(challenger).stake(true, { value: constants.ONE_ETH });

      expect(await pool.getStoredBalance(challenger.address, true)).to.be.equal(constants.ONE_ETH);
      expect(await pool.getStoredBalance(staker.address, true)).to.be.equal(0);
      expect(await pool.getStoredBalance(challenger.address, false)).to.be.equal(0);

      await pool.connect(challenger).stake(true, { value: constants.TWO_ETH });

      expect(await pool.getStoredBalance(challenger.address, true)).to.be.equal(constants.ONE_ETH.mul(3));
      expect(await pool.getStoredBalance(staker.address, true)).to.be.equal(0);
      expect(await pool.getStoredBalance(challenger.address, false)).to.be.equal(0);
    });
  });

  it('getTotalStaked updates properly', async () => {
    expect(await pool.getTotalStaked()).to.equal(0);
    await pool.connect(staker).stake(false, { value: constants.ONE_ETH });
    expect(await pool.getTotalStaked()).to.equal(constants.ONE_ETH);

    //decay does not accrue in same block as stake challenge
    await pool.connect(challenger).stake(true, { value: constants.ONE_ETH });
    expect(await pool.getTotalStaked()).to.equal(constants.ONE_ETH);

    await pool.connect(staker_2).stake(false, { value: constants.ONE_ETH });
    //account for one block decay for challenger side
    const expected = constants.ONE_ETH.mul(2).add(constants.ONE_BLOCK_DECAY);
    expect(await pool.getTotalStaked()).to.equal(expected);
  });

  it('getTotalChallengerStaked updates properly', async () => {
    expect(await pool.getTotalChallengerStaked()).to.equal(0);
    await pool.connect(challenger).stake(true, { value: constants.ONE_ETH });
    expect(await pool.getTotalChallengerStaked()).to.equal(constants.ONE_ETH);

    //decay does not accrue if no staker balance at start of block
    await pool.connect(staker).stake(false, { value: constants.ONE_ETH });
    expect(await pool.getTotalChallengerStaked()).to.equal(constants.ONE_ETH);

    await pool.connect(challenger_2).stake(true, { value: constants.ONE_ETH });
    //account for one block decay for challenger side on initial one eth challenge stake
    const expected = constants.ONE_ETH.mul(2).sub(constants.ONE_BLOCK_DECAY);
    expect(await pool.getTotalChallengerStaked()).to.equal(expected);
  });

  it('numUsers updates properly', async () => {
    const stakingInfo = await pool.stakingInfo();
    const challengerInfo = await pool.challengerInfo();

    await pool.connect(staker).stake(false, { value: constants.ONE_ETH });
    await pool.connect(challenger).stake(true, { value: constants.ONE_ETH });

    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers.add(1));
    expect((await pool.challengerInfo()).numUsers).to.equal(challengerInfo.numUsers.add(1));

    await pool.connect(staker).stake(false, { value: constants.ONE_ETH });
    await pool.connect(challenger).stake(true, { value: constants.ONE_ETH });

    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers.add(1));
    expect((await pool.challengerInfo()).numUsers).to.equal(challengerInfo.numUsers.add(1));

    await pool.connect(staker_2).stake(false, { value: constants.ONE_ETH });
    await pool.connect(challenger_2).stake(true, { value: constants.ONE_ETH });

    expect((await pool.stakingInfo()).numUsers).to.equal(stakingInfo.numUsers.add(2));
    expect((await pool.challengerInfo()).numUsers).to.equal(challengerInfo.numUsers.add(2));
  });

  it('getCheckTestAllowedBlock set correctly after challenger stake', async () => {
    await pool.connect(challenger).stake(true, { value: constants.HALF_ETH });
    const block = await blockNumber();

    expect(await pool.getCheckTestAllowedBlock(challenger.address)).to.equal(block + constants.CHALLENGER_BLOCK_DELAY);
  });

  it('challengers cannot stake less than 0.01 ETH', async () => {
    await expect(pool.connect(challenger).stake(true, { value: constants.ONE_ETH.div(101) })).to.be.revertedWith(
      'ANTE: Challenger must stake more than 0.01 ETH'
    );
  });

  it('should transfer eth into contract on stake support', async () => {
    console.log('t0');
    const orig_wallet_balance = await staker.getBalance();
    const orig_contract_balance = await provider.getBalance(pool.address);

    const txpromise = await pool.connect(staker).stake(false, { value: constants.ONE_ETH });
    const gasCost = await calculateGasUsed(txpromise);

    const after_wallet_balance = await staker.getBalance();
    const after_contract_balance = await provider.getBalance(pool.address);

    // staker wallet balance is 1 eth lower
    expect(orig_wallet_balance.sub(after_wallet_balance).sub(gasCost)).to.be.equal(constants.ONE_ETH);
    // contract wallet balance is 1 eth higher
    expect(after_contract_balance.sub(orig_contract_balance)).to.be.equal(constants.ONE_ETH);
  });

  it('should transfer eth into contract on stake challenge', async () => {
    const orig_wallet_balance = await challenger.getBalance();
    const orig_contract_balance = await provider.getBalance(pool.address);

    const txpromise = await pool.connect(challenger).stake(true, { value: constants.ONE_ETH });
    const gasCost = await calculateGasUsed(txpromise);

    const after_wallet_balance = await challenger.getBalance();
    const after_contract_balance = await provider.getBalance(pool.address);

    // challenger wallet balance is 1 eth lower
    expect(orig_wallet_balance.sub(after_wallet_balance).sub(gasCost)).to.be.equal(constants.ONE_ETH);
    // contract wallet balance is 1 eth higher
    expect(after_contract_balance.sub(orig_contract_balance)).to.be.equal(constants.ONE_ETH);
  });

  it('should emit stake event on stake support with proper args', async () => {
    const stakeAmount = constants.ONE_ETH.div(2);
    await expect(pool.connect(staker).stake(false, { value: stakeAmount }))
      .to.emit(pool, 'Stake')
      .withArgs(staker.address, stakeAmount, false);
  });

  it('should emit stake event on stake challenge with proper args', async () => {
    const stakeAmount = constants.ONE_ETH.div(2);
    await expect(pool.connect(challenger).stake(true, { value: stakeAmount }))
      .to.emit(pool, 'Stake')
      .withArgs(challenger.address, stakeAmount, true);
  });
});
