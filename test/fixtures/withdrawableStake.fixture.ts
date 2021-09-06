import { providers, Wallet } from 'ethers';

import { BasicFixture } from './basic.fixture';
import { oneSupportChallengeFixture } from './oneSupportChallenge.fixture';
import * as constants from '../constants';
import { evmIncreaseTime } from '../helpers';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture } = waffle;

export async function withdrawableStakeFixture(w: Wallet[], p: providers.Web3Provider): Promise<BasicFixture> {
  const [staker] = waffle.provider.getWallets();
  const basicDeployment = await loadFixture(oneSupportChallengeFixture);

  const pool = basicDeployment.oddBlockDeployment.pool;
  await pool.connect(staker).unstake(constants.HALF_ETH, false);

  await evmIncreaseTime(constants.ONE_DAY_IN_SECONDS + 1);

  return basicDeployment;
}
