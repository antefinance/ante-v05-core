/* eslint no-use-before-define: "warn" */
import chalk from 'chalk';
import hre from 'hardhat';
import { mineBlocks, deployTestAndPool, deployContract } from '../helpers';

const main = async () => {
  console.log('\n\n 📡 Creating Mock data...\n');

  console.log('Deploying pool factory... \n');
  const poolFactory = await deployContract(hre, 'AntePoolFactory', []);

  const signers = await hre.ethers.getSigners();

  const oneETH = hre.ethers.utils.parseUnits('1.0');
  const twoETH = oneETH.mul(2);
  const threeETH = oneETH.mul(3);

  let { test, pool } = await deployTestAndPool(hre, poolFactory, 'AnteOddBlockTest', []);
  await test.setWillTest(true);

  await pool.connect(signers[1]).stake(true, { value: twoETH });
  await pool.connect(signers[0]).stake(false, { value: oneETH });
  await pool.connect(signers[2]).stake(false, { value: threeETH });
  console.log('Staked ', chalk.red('2 ETH'), 'from address', chalk.red(signers[1].address), 'in pool as challenger');
  console.log('Staked ', chalk.red('1 ETH'), 'from address', chalk.red(signers[0].address), 'in pool as staker');
  console.log('Staked ', chalk.red('3 ETH'), 'from address', chalk.red(signers[2].address), 'in pool as staker');
  console.log(
    chalk.cyan('This test can be made to fail if checkTest is called on an even block (just call it twice in a row)')
  );

  ({ test, pool } = await deployTestAndPool(hre, poolFactory, 'AnteRevertingTest', []));
  await pool.connect(signers[3]).stake(true, { value: twoETH });
  await pool.connect(signers[4]).stake(false, { value: oneETH });
  await pool.connect(signers[5]).stake(true, { value: threeETH });
  console.log('Staked ', chalk.red('2 ETH'), 'from address', chalk.red(signers[3].address), 'in pool as challenger');
  console.log('Staked ', chalk.red('1 ETH'), 'from address', chalk.red(signers[4].address), 'in pool as staker');
  console.log('Staked ', chalk.red('3 ETH'), 'from address', chalk.red(signers[5].address), 'in pool as challenger');

  await mineBlocks(hre, 12);
  await test.setWillRevert(true);
  await pool.connect(signers[3]).checkTest();

  console.log('This test is', chalk.magenta('failing'), '. Fail triggered by', chalk.cyan(signers[3].address));

  ({ pool } = await deployTestAndPool(hre, poolFactory, 'AnteDummyTest', []));

  await pool.connect(signers[6]).stake(true, { value: twoETH });
  await pool.connect(signers[7]).stake(false, { value: oneETH });
  await pool.connect(signers[8]).stake(true, { value: threeETH });
  await pool.connect(signers[9]).stake(false, { value: twoETH });
  console.log('Staked ', chalk.red('2 ETH'), 'from address', chalk.red(signers[6].address), 'in pool as challenger');
  console.log('Staked ', chalk.red('1 ETH'), 'from address', chalk.red(signers[7].address), 'in pool as staker');
  console.log('Staked ', chalk.red('3 ETH'), 'from address', chalk.red(signers[8].address), 'in pool as challenger');
  console.log('Staked ', chalk.red('2 ETH'), 'from address', chalk.red(signers[9].address), 'in pool as staker');

  await pool.connect(signers[9]).unstake(oneETH, false);
  console.log(
    'Initiated unstake of ',
    chalk.red('1 ETH'),
    'from address',
    chalk.red(signers[9].address),
    '. This stake is withdrawable'
  );

  console.log(
    chalk.cyan(
      "This pool's associated test has a protocolName and testedContracts variable set for use in the front-end. The test address is"
    ),
    chalk.magenta(await pool.anteTest())
  );
  console.log(chalk.cyan('This test will always pass on call of checkTest()'));

  // advance blocktime by at least one day
  console.log('Advancing time by 1 day');
  await hre.network.provider.send('evm_increaseTime', [86400 + 1]);

  console.log('Mining 10000 blocks to let some decay accumulate');
  await mineBlocks(hre, 10000);

  await pool.connect(signers[7]).unstakeAll(false);
  console.log(
    'Initiated unstake of ',
    chalk.red('full balance'),
    'from address',
    chalk.red(signers[7].address),
    '. This stake is NOT withdrawable for 1 day'
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
