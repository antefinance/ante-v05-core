import hre from 'hardhat';
const { waffle } = hre;

import { AnteWETH9Test__factory, AnteWETH9Test } from '../../typechain';

import { evmSnapshot, evmRevert } from '../helpers';
import { expect } from 'chai';

describe('AnteWETH9Test', function () {
  let test: AnteWETH9Test;

  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evmSnapshot();

    const [deployer] = waffle.provider.getWallets();
    const factory = (await hre.ethers.getContractFactory('AnteWETH9Test', deployer)) as AnteWETH9Test__factory;
    test = await factory.deploy();
    await test.deployed();
  });

  after(async () => {
    await evmRevert(globalSnapshotId);
  });

  it('should pass', async () => {
    expect(await test.checkTestPasses()).to.be.true;
  });
});
