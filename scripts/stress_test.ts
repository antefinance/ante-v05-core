import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract } from 'ethers';
import hre from 'hardhat';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs';

import * as constants from './constants';
import {
  distributeETH,
  loadDeployment,
  calculateGasUsed,
  delay,
  randomNumber,
  mineBlocks,
  blockNumber,
} from './helpers';

interface WalletData {
  stakerBalance: string;
  challengerBalance: string;
  pendingWithdrawBalance: string;
  walletBalance: string;
}

interface PoolBalances {
  totalStaked: string;
  totalChallenged: string;
  numStakeUsers: string;
  numChallengeUsers: string;
}

interface StressTestData {
  iteration: number;
  startTimestamp: number;
  currentTimestamp: number;
  startBlock: number;
  currentBlock: number;
  deployment: constants.Deployment;
  initialBalances: Record<string, string>;
  gasUsed: Record<string, string>;
  currentBalances: Record<string, string>;
  relativeDiff: Record<string, number>;
  sumError: string;
  walletDataStake: Record<string, Record<string, string>>;
  walletDataUnstake: Record<string, Record<string, string>>;
}

const sleepOrAdvanceBlocks = async (
  minSleepTime: number,
  maxSleepTime: number,
  minBlocks: number,
  maxBlocks: number
) => {
  if (hre.network.name != 'localhost') {
    const sleepTime = randomNumber(minSleepTime, maxSleepTime);
    console.log('Sleeping for ', chalk.red((sleepTime / 1000).toString()), 'seconds');
    await delay(sleepTime);
  } else {
    const numBlocks = Math.floor(randomNumber(minBlocks, maxBlocks));
    console.log('Mining ', chalk.red(numBlocks.toString()), 'blocks');
    await mineBlocks(hre, numBlocks);
  }
};

const calculateAndSaveStressTestData = async (
  fileBase: string,
  iteration: number,
  startTimestamp: number,
  startBlock: number,
  deployment: constants.Deployment,
  gasUsed: Record<string, BigNumber>,
  initialBalances: Record<string, BigNumber>,
  stakeBalanceData: any,
  testers: SignerWithAddress[],
  pools: Contract[]
): Promise<void> => {
  const stressTestData: StressTestData = {
    iteration: iteration,
    startTimestamp: startTimestamp,
    currentTimestamp: new Date().getTime(),
    startBlock: startBlock,
    currentBlock: await blockNumber(testers[0]),
    deployment: deployment,
    initialBalances: {},
    gasUsed: {},
    currentBalances: {},
    relativeDiff: {},
    sumError: '',
    walletDataStake: {},
    walletDataUnstake: {},
  };

  const unstakeBalanceData = await getCurrentBalances(testers, pools);
  const currentBalances = unstakeBalanceData['balances'];

  const differences = await compareBalances(initialBalances, currentBalances, gasUsed, testers);

  const gasUsedFormatted: Record<string, string> = {};
  const initialBalancesFormatted: Record<string, string> = {};
  const currentBalancesFormatted: Record<string, string> = {};
  const relativeError: Record<string, number> = {};
  const walletDataStakeFormatted: Record<string, Record<string, string>> = {};
  const walletDataUnstakeFormatted: Record<string, Record<string, string>> = {};

  let sumError = BigNumber.from(0);

  for (const tester of testers) {
    const wStakeFormatted: Record<string, string> = {};
    const wUnstakeFormatted: Record<string, string> = {};
    gasUsedFormatted[tester.address] = gasUsed[tester.address].toString();
    initialBalancesFormatted[tester.address] = initialBalances[tester.address].toString();
    currentBalancesFormatted[tester.address] = currentBalances[tester.address].toString();

    for (const attr in unstakeBalanceData['walletData'][tester.address]) {
      wStakeFormatted[attr] = stakeBalanceData['walletData'][tester.address][attr].toString();
      wUnstakeFormatted[attr] = unstakeBalanceData['walletData'][tester.address][attr].toString();
    }

    walletDataStakeFormatted[tester.address] = wStakeFormatted;
    walletDataUnstakeFormatted[tester.address] = wUnstakeFormatted;

    relativeError[tester.address] =
      differences[tester.address].mul(100000000).div(initialBalances[tester.address]).toNumber() / 100000000;

    sumError = sumError.add(differences[tester.address]);
  }

  stressTestData['gasUsed'] = gasUsedFormatted;
  stressTestData['initialBalances'] = initialBalancesFormatted;
  stressTestData['currentBalances'] = currentBalancesFormatted;
  stressTestData['relativeDiff'] = relativeError;
  stressTestData['sumError'] = sumError.toString();
  stressTestData['walletDataStake'] = walletDataStakeFormatted;
  stressTestData['walletDataUnstake'] = walletDataUnstakeFormatted;

  const file = `${fileBase}_${iteration}.json`;
  stressTestData['currentTimestamp'] = new Date().getTime();
  console.log('saving stress data to ', chalk.red(file));
  fs.writeFileSync(file, JSON.stringify(stressTestData, null, '  '), 'utf8');
};

const getCurrentBalances = async (testers: SignerWithAddress[], pools: Contract[]): Promise<any> => {
  const balances: Record<string, BigNumber> = {};
  const walletData: Record<string, Record<string, BigNumber>> = {};

  for (const tester of testers) {
    walletData[tester.address] = {
      walletBalance: await tester.getBalance(),
      stakerBalance: BigNumber.from(0),
      challengerBalance: BigNumber.from(0),
      pendingWithdrawBalance: BigNumber.from(0),
    };
    balances[tester.address] = walletData[tester.address]['walletBalance'];

    for (const pool of pools) {
      const stakerBalance = await pool.getStoredBalance(tester.address, false);
      const pendingWithdrawBalance = await pool.getPendingWithdrawAmount(tester.address);
      const challengerBalance = await pool.getStoredBalance(tester.address, true);

      walletData[tester.address]['stakerBalance'] = walletData[tester.address]['stakerBalance'].add(stakerBalance);
      walletData[tester.address]['pendingWithdrawBalance'] =
        walletData[tester.address]['pendingWithdrawBalance'].add(pendingWithdrawBalance);
      walletData[tester.address]['challengerBalance'] =
        walletData[tester.address]['challengerBalance'].add(challengerBalance);

      balances[tester.address] = balances[tester.address]
        .add(stakerBalance)
        .add(challengerBalance)
        .add(pendingWithdrawBalance);
    }
  }

  return {
    balances,
    walletData,
  };
};

const compareBalances = async (
  initialBalances: Record<string, BigNumber>,
  currentBalances: Record<string, BigNumber>,
  gasUsed: Record<string, BigNumber>,
  testers: SignerWithAddress[]
): Promise<Record<string, BigNumber>> => {
  const differences: Record<string, BigNumber> = {};

  for (const tester of testers) {
    differences[tester.address] = currentBalances[tester.address]
      .add(gasUsed[tester.address])
      .sub(initialBalances[tester.address]);
  }

  return differences;
};

/*
const getPoolBalanceStats = async(testers: SignerWithAddress[], pools: Contract[]) => {

}
*/

const stressStakeStep = async (pools: Contract[], testers: SignerWithAddress[], gasUsed: Record<string, BigNumber>) => {
  let txpromise: any;
  const MIN_STAKE = constants.ONE_ETH.div(100);
  for (const tester of testers) {
    // select two random pools and stake/challenge random amount
    for (let i = 0; i < 2; i++) {
      const pool = pools[Math.floor(randomNumber(0, pools.length))];
      // check if has a pending withdraw balance
      const pendingWithdrawBalance = await pool.getPendingWithdrawAmount(tester.address);
      if (pendingWithdrawBalance.gt(0)) {
        txpromise = await pool.connect(tester).cancelPendingWithdraw();
        gasUsed[tester.address] = gasUsed[tester.address].add(await calculateGasUsed(txpromise));
      } else {
        // choose between staking and challenging
        const isChallenger = randomNumber(0, 2) > 1 ? true : false;
        // choose random amount
        const balance = await tester.getBalance();
        const stakeAmount = balance.div(2).add(balance.div(100).mul(Math.floor(randomNumber(0, 10))));

        if (stakeAmount.lt(MIN_STAKE)) {
          continue;
        }

        txpromise = await pool.connect(tester).stake(isChallenger, { value: stakeAmount });
        gasUsed[tester.address] = gasUsed[tester.address].add(await calculateGasUsed(txpromise));
      }
    }
  }
};

const stressUnstakeStep = async (
  pools: Contract[],
  testers: SignerWithAddress[],
  gasUsed: Record<string, BigNumber>
) => {
  let txpromise: any;
  for (const tester of testers) {
    for (const pool of pools) {
      // check staker and challenger balances and unstake if nonzero with 50% probability
      if ((await pool.getStoredBalance(tester.address, true)).gt(0) && randomNumber(0, 2) > 1) {
        txpromise = await pool.connect(tester).unstakeAll(true);
        gasUsed[tester.address] = gasUsed[tester.address].add(await calculateGasUsed(txpromise));
      }

      if ((await pool.getStoredBalance(tester.address, false)).gt(0) && randomNumber(0, 2) > 1) {
        txpromise = await pool.connect(tester).unstakeAll(false);
        gasUsed[tester.address] = gasUsed[tester.address].add(await calculateGasUsed(txpromise));
      }
    }
  }

  // advance time and withdraw pending stakes if on localhost
  // to avoid situation where stakes and challenges become unbalanced
  if (hre.network.name == 'localhost') {
    await hre.network.provider.send('evm_increaseTime', [86500]);
    for (const tester of testers) {
      for (const pool of pools) {
        if ((await pool.getPendingWithdrawAmount(tester.address)).gt(0)) {
          txpromise = await pool.connect(tester).withdrawStake();
          gasUsed[tester.address] = gasUsed[tester.address].add(await calculateGasUsed(txpromise));
        }
      }
    }
  }
};

const main = async () => {
  // mnemonic generates 20 signers to test with
  const wallets = await hre.ethers.getSigners();
  const testers = [...wallets];

  const network = hre.network.name;
  const deploymentFile = path.resolve(__dirname, `./deployments/${network}.json`);
  const stressTestBase = path.resolve(__dirname, `./stress_test_${network}`);

  const MAX_NUM_ITERATIONS = 100;
  let iteration: number = 0;

  let deployment: constants.Deployment;
  console.log(`Attempting to load existing deployment from file ${deploymentFile}`);
  try {
    deployment = loadDeployment(deploymentFile);
  } catch (e) {
    console.log(`no existing deployment found, exiting...`);
    process.exit(1);
  }

  // distribute eth to testing accounts if needed
  console.log('distributing eth to tester accounts if necessary');
  await distributeETH(constants.ONE_ETH.div(2), testers[0], testers);

  const pools: Contract[] = [];
  for (const p in deployment['testPools']) {
    pools.push(await hre.ethers.getContractAt('AntePool', deployment['testPools'][p]['pool']['address']));
  }

  console.log('beginning stress test');
  const initialBalanceData = await getCurrentBalances(testers, pools);
  const initialBalances = initialBalanceData['balances'];

  // initialize gasUsed record
  const gasUsed: Record<string, BigNumber> = {};
  for (const tester of testers) {
    gasUsed[tester.address] = BigNumber.from(0);
  }

  const START_TIMESTAMP = new Date().getTime();
  const START_BLOCK = await blockNumber(testers[0]);

  // stress testing code
  while (iteration < MAX_NUM_ITERATIONS) {
    iteration += 1;
    console.log('Beginning stress test iteration ', chalk.red(iteration.toString()));
    await stressStakeStep(pools, testers, gasUsed);
    const stakeBalanceData = await getCurrentBalances(testers, pools);

    // sleep for random amount of time between 5-10 minutes before unstake
    console.log('Iteration ', chalk.red(iteration.toString()), ': stake step finished');
    await sleepOrAdvanceBlocks(300000, 600000, 2000, 5000);

    await stressUnstakeStep(pools, testers, gasUsed);

    // update stress test data
    await calculateAndSaveStressTestData(
      stressTestBase,
      iteration,
      START_TIMESTAMP,
      START_BLOCK,
      deployment,
      gasUsed,
      initialBalances,
      stakeBalanceData,
      testers,
      pools
    );
    // sleep for random amount of time before next iteration
    console.log('Iteration ', chalk.red(iteration.toString()), 'finished');
    await sleepOrAdvanceBlocks(120000, 300000, 1000, 3000);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
