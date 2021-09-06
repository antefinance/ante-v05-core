import hre from 'hardhat';

const { waffle } = hre;

import { ContractFactory, Contract, BigNumber, Wallet } from 'ethers';
import * as constants from './constants';
import { AntePool, AntePoolFactory } from '../typechain';

import { expect, assert } from 'chai';

export async function blockTimestamp(): Promise<number> {
  return (await waffle.provider.getBlock('latest')).timestamp;
}

export async function blockNumber(): Promise<number> {
  return (await waffle.provider.getBlock('latest')).number;
}

export async function evmSnapshot(): Promise<any> {
  return await hre.network.provider.request({
    method: 'evm_snapshot',
    params: [],
  });
}

export async function evmRevert(snapshotId: string): Promise<void> {
  await hre.network.provider.request({
    method: 'evm_revert',
    params: [snapshotId],
  });
}

export async function evmIncreaseTime(seconds: number) {
  await hre.network.provider.send('evm_increaseTime', [seconds]);
}

export async function evmMineBlocks(numBlocks: number) {
  for (let i = 0; i < numBlocks; i++) {
    await hre.network.provider.send('evm_mine');
  }
}

export async function evmLastMinedBlockNumber(): Promise<BigNumber> {
  return BigNumber.from(await hre.network.provider.send('eth_blockNumber'));
}

export async function triggerOddBlockTestFailure(
  pool: Contract,
  challenger: Wallet,
  waitTwelveBlocks = true
): Promise<void> {
  if (waitTwelveBlocks) {
    await evmMineBlocks(12);
  }

  // make sure checkTest is triggered on even block
  const block_num = await hre.network.provider.send('eth_blockNumber');
  if (block_num % 2 != 1) {
    await hre.network.provider.send('evm_mine');
  }
  await pool.connect(challenger).checkTest();

  assert(await pool.pendingFailure());
}

export async function deployTestAndPool(
  deployer: any,
  poolFactory: AntePoolFactory,
  testContractFactory: ContractFactory,
  testArgs: any[]
): Promise<constants.TestPoolDeployment> {
  const testContract = await testContractFactory.deploy(...testArgs);
  await testContract.deployed();

  const tx = await poolFactory.createPool(testContract.address);
  const receipt = await tx.wait();

  // @ts-ignore
  const testPoolAddress = receipt.events[0].args['testPool'];
  const poolContract = <AntePool>await hre.ethers.getContractAt('AntePool', testPoolAddress);

  return {
    test: testContract,
    pool: poolContract,
  };
}

export async function calculateGasUsed(txpromise: any): Promise<BigNumber> {
  const txreceipt = await txpromise.wait();
  return txreceipt.effectiveGasPrice.mul(txreceipt.cumulativeGasUsed);
}

export function calculateDecay(initialAmount: BigNumber, numBlocks: number): BigNumber {
  return initialAmount.mul(numBlocks).mul(constants.ONE_BLOCK_DECAY).div(constants.ONE_ETH);
}

export async function getExpectedStakerBalance(staker: Wallet, pool: AntePool, numBlocks: number): Promise<BigNumber> {
  const totalChallengerStaked = await pool.getTotalChallengerStaked();
  const totalStaked = await pool.getTotalStaked();
  const stakerBalance = await pool.getStoredBalance(staker.address, false);

  const decay = calculateDecay(totalChallengerStaked, numBlocks);

  return stakerBalance.add(decay.mul(stakerBalance).div(totalStaked));
}

export async function getExpectedChallengerBalance(
  challenger: Wallet,
  pool: AntePool,
  numBlocks: number
): Promise<BigNumber> {
  const challengerBalance = await pool.getStoredBalance(challenger.address, true);
  const decay = calculateDecay(challengerBalance, numBlocks);
  return challengerBalance.sub(decay);
}

export function expectAlmostEqual(num1: BigNumber, num2: BigNumber, tolerance: number): void {
  expect(num1.sub(num2).abs()).to.be.lt(tolerance);
}

export async function getExpectedChallengerPayoutWithoutBounty(challenger: Wallet, pool: AntePool): Promise<BigNumber> {
  const totalChallenged = (await pool.pendingFailure())
    ? await pool.getTotalChallengerEligibleBalance()
    : await pool.getTotalChallengerStaked();
  const totalStaked = (await pool.getTotalStaked()).add(await pool.getTotalPendingWithdraw());

  const bounty = await pool.getVerifierBounty();
  const challengerBalance = await pool.getStoredBalance(challenger.address, true);
  return challengerBalance.add(totalStaked.sub(bounty).mul(challengerBalance).div(totalChallenged));
}
