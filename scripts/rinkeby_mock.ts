/* eslint no-use-before-define: "warn" */
import chalk from 'chalk';
import hre from 'hardhat';

import { deployTestAndPool } from './helpers';

const main = async () => {
  const network = hre.network.name;

  console.log('Deploying to network', chalk.red(network));

  for (let i = 0; i < 3; i++) {
    let { test } = await deployTestAndPool(hre, 'AnteOddBlockTest', []);
    await test.setWillTest(true);
  }

  for (let i = 0; i < 2; i++) {
    let { test } = await deployTestAndPool(hre, 'AnteRevertingTest', []);
    await test.setWillRevert(true);
  }

  for (let i = 0; i < 2; i++) {
    await deployTestAndPool(hre, 'AnteDummyTest', []);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
