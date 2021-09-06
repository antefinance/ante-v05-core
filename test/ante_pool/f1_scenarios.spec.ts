import { basicFixture, BasicFixture } from '../fixtures/basic.fixture';
import { evmSnapshot, evmRevert } from '../helpers';

import { Contract } from 'ethers';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;
import fs from 'fs';
import path from 'path';

import { expect } from 'chai';

interface Action {
  [id: string]: any;
}

/**
 * @param fullpath Path to a CSV file of scenarios
 * @returns A list of scenarios, of type:
 * [
 *   ["My scenario name", [
 *     {
 *       actionType: "STAKE",
 *       amount: 1,
 *       signerIndex: 0,
 *       amountsToCheck: [signerToCheck, isCounter, expectedAmount]
 *     },
 *     ...
 *   ]]
 * ]
 */
function loadScenarios(fullPath: string) {
  const text = fs.readFileSync(fullPath, 'utf8');

  const lines = text.split(/\r\n|\n/);
  const headers = lines[0].split(',');
  const scenarios = [];

  let scenarioName: string = '';
  let actions: Action[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].split(',');

    // New scenario.
    if (line[0] && line[0] !== scenarioName) {
      scenarioName = line[0];
      actions = [];
      scenarios.push({ scenarioName, actions });
    }

    // Read the action stored on this line.
    try {
      let action: Action = {
        amountsToCheck: [],
      };

      for (let j = 1; j < Math.min(headers.length, line.length); j++) {
        if (line[j].length === 0) {
          continue;
        }
        if (!headers[j].startsWith('check_')) {
          action[headers[j]] = line[j];
        } else {
          const signerToCheck = headers[j].charAt(7);
          const isCounter = headers[j].charAt(6) === 'c';
          const expectedAmount = line[j];
          action.amountsToCheck.push([signerToCheck, isCounter, expectedAmount]);
        }
      }

      // Empty line
      if (action.actionType === undefined) {
        continue;
      }

      // Check that the action was initialized properly
      if (!['ADVANCE_BLOCKS', 'STAKE', 'UNSTAKE', 'COUNTERSTAKE', 'COUNTERUNSTAKE'].includes(action.actionType)) {
        throw new Error('Unrecognized actionType: ' + action.actionType);
      }
      if (action.amount === undefined) {
        throw new Error('Undefined amount');
      }
      if (
        ['STAKE', 'UNSTAKE', 'COUNTERSTAKE', 'COUNTERUNSTAKE'].includes(action.actionType) &&
        action.signer === undefined
      ) {
        throw new Error('Undefined signer for actionType=' + action.actionType);
      }

      actions.push(action);
    } catch (error) {
      error.message = 'Line ' + i + ': ' + error.message;
      throw error;
    }
  }
  return scenarios;
}

const basePath = path.join(process.cwd());
const baseScenarioPath = path.join(path.join(basePath, 'test'), 'ante_pool');

const scenarios = loadScenarios(path.join(baseScenarioPath, 'scenarios.csv'));

describe('Scenarios', function () {
  const wallets = provider.getWallets();

  let deployment: BasicFixture;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pool: Contract;

  before(async () => {
    deployment = await loadFixture(basicFixture);
    globalSnapshotId = await evmSnapshot();
    snapshotId = await evmSnapshot();

    pool = deployment.oddBlockDeployment.pool;
  });

  after(async () => {
    await evmRevert(globalSnapshotId);
  });

  scenarios.forEach((s) => {
    const { scenarioName, actions } = s;
    describe(scenarioName, function () {
      after(async () => {
        await evmRevert(snapshotId);
        snapshotId = await evmSnapshot();
      });

      for (const action of actions) {
        const actionType = action.actionType;
        const amount = action.amount;
        const signerIndex = action.signer;
        let testName = actionType + ' amount=' + amount;
        if (signerIndex) {
          testName += ' signer=' + signerIndex;
        }
        // eslint-disable-next-line no-loop-func
        it(testName, async function () {
          // Execute the action
          if (['STAKE', 'UNSTAKE', 'COUNTERSTAKE', 'COUNTERUNSTAKE'].includes(actionType)) {
            const ethAmount = hre.ethers.utils.parseEther(amount);
            const signer = wallets[signerIndex];
            const isCounter = actionType.startsWith('COUNTER');

            if (actionType === 'STAKE' || actionType === 'COUNTERSTAKE') {
              await expect(pool.connect(signer).stake(isCounter, { value: ethAmount }))
                .to.emit(pool, 'Stake')
                .withArgs(signer.address, ethAmount, isCounter);
            } else if (actionType === 'UNSTAKE' || actionType === 'COUNTERUNSTAKE') {
              await expect(pool.connect(signer).unstake(ethAmount, isCounter))
                .to.emit(pool, 'Unstake')
                .withArgs(signer.address, ethAmount, isCounter);
            }
          } else if (actionType === 'ADVANCE_BLOCKS') {
            // TODO currently let's always assume 1 advanced block, until we get mocks working
            await pool.updateDecay();
          }

          // Check the balances
          for (const amountToCheck of action.amountsToCheck) {
            const [signerToCheck, isCounter, expectedAmount] = amountToCheck;
            const ethExpectedAmount = hre.ethers.utils.parseEther(expectedAmount);
            expect(
              // eslint-disable-next-line no-await-in-loop
              await pool.getStoredBalance(wallets[signerToCheck].address, isCounter)
            ).to.equal(ethExpectedAmount);
          }
        });
      }
    });
  });
});
