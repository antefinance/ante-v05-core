import { providers, Wallet } from 'ethers';

import { RevertingTestFixture, revertingTestFixture } from './revertingTest.fixture';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture } = waffle;

import { assert } from 'chai';

export async function failedTestFixture(w: Wallet[], p: providers.Web3Provider): Promise<RevertingTestFixture> {
  const [staker, challenger] = waffle.provider.getWallets();
  const revertingTestDeployment = await loadFixture(revertingTestFixture);

  // stake 1 ETH on staker and challenger side
  const { pool, test } = revertingTestDeployment.revertingTestDeployment;

  // trigger test failure
  await test.setWillRevert(true);
  await pool.connect(challenger).checkTest();

  assert(await pool.pendingFailure());

  return revertingTestDeployment;
}
