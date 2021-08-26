import { providers, Wallet } from 'ethers';

import { BasicFixture, basicFixture } from './basic.fixture';
import * as constants from '../constants';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture } = waffle;

export async function oneSupportChallengeFixture(w: Wallet[], p: providers.Web3Provider): Promise<BasicFixture> {
  const [staker, challenger] = waffle.provider.getWallets();
  const basicDeployment = await loadFixture(basicFixture);

  // stake 1 ETH on staker and challenger side
  const pool = basicDeployment.oddBlockDeployment.pool;
  await pool.connect(staker).stake(false, { value: constants.ONE_ETH });
  await pool.connect(challenger).stake(true, { value: constants.ONE_ETH });

  return basicDeployment;
}
