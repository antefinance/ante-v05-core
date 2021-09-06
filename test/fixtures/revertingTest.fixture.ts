import { providers, Wallet } from 'ethers';

import { AntePoolFactory, AnteRevertingTest, AnteRevertingTest__factory } from '../../typechain';

import { basicFixture } from './basic.fixture';
import * as constants from '../constants';

import hre from 'hardhat';
import { deployTestAndPool, evmMineBlocks, evmIncreaseTime } from '../helpers';
const { waffle } = hre;
const { loadFixture } = waffle;

export interface RevertingTestFixture {
  poolFactory: AntePoolFactory;
  revertingTestDeployment: constants.TestPoolDeployment;
}

export async function revertingTestFixture(w: Wallet[], p: providers.Web3Provider): Promise<RevertingTestFixture> {
  const [staker, challenger, staker_2, challenger_2, challenger_3] = waffle.provider.getWallets();
  const basicDeployment = await loadFixture(basicFixture);

  const poolFactory = basicDeployment.poolFactory;

  const revertingFactory = (await hre.ethers.getContractFactory(
    'AnteRevertingTest',
    staker
  )) as AnteRevertingTest__factory;
  const revertingTestDeployment = await deployTestAndPool(staker, poolFactory, revertingFactory, []);

  // stake 1 ETH on staker and a few ETH on challenger side
  const pool = revertingTestDeployment.pool;
  await pool.connect(staker).stake(false, { value: constants.ONE_ETH });
  await pool.connect(challenger).stake(true, { value: constants.ONE_ETH });
  await pool.connect(staker_2).stake(false, { value: constants.TWO_ETH });
  await pool.connect(challenger_2).stake(true, { value: constants.TWO_ETH });

  // intiate withdraw of some of stake
  await pool.connect(staker).unstakeAll(false);
  await evmIncreaseTime(constants.ONE_DAY_IN_SECONDS + 1);
  await evmMineBlocks(12);

  // ineligible challenger
  await pool.connect(challenger_3).stake(true, { value: constants.ONE_ETH.mul(100) });

  return {
    poolFactory,
    revertingTestDeployment,
  };
}
