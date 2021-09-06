import { BasicFixture } from '../fixtures/basic.fixture';
import { oneSupportChallengeFixture } from '../fixtures/oneSupportChallenge.fixture';
import {
  evmSnapshot,
  evmRevert,
  evmLastMinedBlockNumber,
  evmMineBlocks,
  triggerOddBlockTestFailure,
  getExpectedChallengerBalance,
  getExpectedStakerBalance,
  calculateDecay,
  expectAlmostEqual,
} from '../helpers';

import * as constants from '../constants';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

import { expect } from 'chai';
import { AntePool } from '../../typechain';

describe('Decay Calculations', function () {
  const wallets = provider.getWallets();
  const [staker, challenger, staker_2] = wallets;

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

  it('balances correct after one block of decay', async () => {
    // balances pre-decay should be 1 eth on both staker and challenger side
    expect(await pool.getStoredBalance(staker.address, false)).to.equal(constants.ONE_ETH);
    expect(await pool.getStoredBalance(challenger.address, true)).to.equal(constants.ONE_ETH);

    // advance 1 block
    await pool.updateDecay();

    // check balances postdecay
    expect(await pool.getStoredBalance(staker.address, false)).to.equal(
      constants.ONE_ETH.add(constants.ONE_BLOCK_DECAY)
    );
    expect(await pool.getStoredBalance(challenger.address, true)).to.equal(
      constants.ONE_ETH.sub(constants.ONE_BLOCK_DECAY)
    );
  });

  it('lastUpdateBlock updates correctly', async () => {
    const lastMinedBlock = await evmLastMinedBlockNumber();
    expect(await pool.lastUpdateBlock()).to.be.lte(lastMinedBlock);

    // update pool and mine block
    await pool.updateDecay();

    expect(await pool.lastUpdateBlock()).to.equal(lastMinedBlock.add(1));
  });

  it('getStoredBalance displays proper user balance without updateDecay call', async () => {
    // let some decay accumulate
    const expectedSupporterBalance = await getExpectedStakerBalance(staker, pool, 10);
    const expectedChallengerBalance = await getExpectedChallengerBalance(challenger, pool, 10);
    await evmMineBlocks(10);

    expect(await pool.getStoredBalance(staker.address, false)).to.be.equal(expectedSupporterBalance);
    expect(await pool.getStoredBalance(challenger.address, true)).to.be.equal(expectedChallengerBalance);
  });

  it('totalAmount updates properly on updateDecay call', async () => {
    // let some decay accumulate
    await evmMineBlocks(9);
    await pool.updateDecay();

    const total_decay = calculateDecay(constants.ONE_ETH, 10);
    expect(await pool.getTotalStaked()).to.equal(constants.ONE_ETH.add(total_decay));
    expect(await pool.getTotalChallengerStaked()).to.equal(constants.ONE_ETH.sub(total_decay));
  });

  it("decay calculation doesn't include staker funds pending withdrawal", async () => {
    // unstake 0.5 eth for first staker and add a second staker with a 1 ETH stake
    const expected = await getExpectedStakerBalance(staker, pool, 1);
    await pool.connect(staker).unstake(constants.HALF_ETH, false);
    expect(await pool.getStoredBalance(staker.address, false)).to.equal(expected.sub(constants.HALF_ETH));

    await pool.connect(staker_2).stake(false, { value: constants.ONE_ETH });

    const expectedSupporterOneBalance = await getExpectedStakerBalance(staker, pool, 10);
    const expectedSupporterTwoBalance = await getExpectedStakerBalance(staker_2, pool, 10);
    // let some decay accumulate
    await evmMineBlocks(10);
    const stakerOneNewBalance = await pool.getStoredBalance(staker.address, false);
    const stakerTwoNewBalance = await pool.getStoredBalance(staker_2.address, false);

    expectAlmostEqual(stakerOneNewBalance, expectedSupporterOneBalance, 2);
    expectAlmostEqual(stakerTwoNewBalance, expectedSupporterTwoBalance, 2);
    // no decay accumulates on pending withdraw amount
    expect(await pool.getPendingWithdrawAmount(staker.address)).to.equal(constants.HALF_ETH);
  });

  it('decay stops accruing after test failure', async () => {
    await triggerOddBlockTestFailure(pool, challenger);

    const stakeAmount = await pool.getTotalStaked();
    const challengeAmount = await pool.getTotalChallengerStaked();

    // let some time pass
    await evmMineBlocks(10);

    await pool.updateDecay();
    // check that decay stopped updating
    expect(await pool.getTotalStaked()).to.equal(stakeAmount);
    expect(await pool.getTotalChallengerStaked()).to.equal(challengeAmount);
  });
});
