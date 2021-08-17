// ┏━━━┓━━━━━┏┓━━━━━━━━━┏━━━┓━━━━━━━━━━━━━━━━━━━━━━━
// ┃┏━┓┃━━━━┏┛┗┓━━━━━━━━┃┏━━┛━━━━━━━━━━━━━━━━━━━━━━━
// ┃┗━┛┃┏━┓━┗┓┏┛┏━━┓━━━━┃┗━━┓┏┓┏━┓━┏━━┓━┏━┓━┏━━┓┏━━┓
// ┃┏━┓┃┃┏┓┓━┃┃━┃┏┓┃━━━━┃┏━━┛┣┫┃┏┓┓┗━┓┃━┃┏┓┓┃┏━┛┃┏┓┃
// ┃┃ ┃┃┃┃┃┃━┃┗┓┃┃━┫━┏┓━┃┃━━━┃┃┃┃┃┃┃┗┛┗┓┃┃┃┃┃┗━┓┃┃━┫
// ┗┛ ┗┛┗┛┗┛━┗━┛┗━━┛━┗┛━┗┛━━━┗┛┗┛┗┛┗━━━┛┗┛┗┛┗━━┛┗━━┛
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "../AntePool.sol";
import "../AnteTest.sol";

// Ante Test to check if contract state matches Eth balance state in pool
contract AnteAnteTest is AnteTest("Ante Test checks contract state to match Eth balance") { 

    constructor () {
        testedContracts = [
            0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512,
            0x5FC8d32690cc91D4c39d9d3abcBD16989F875707,
            0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
        ];
        protocolName = "Ante";
    }
    
    function checkTestPasses() public view override returns (bool) {

        for (uint i = 0; i < testedContracts.length; i++) {
            AntePool antePool = AntePool(testedContracts[i]);
            // totalPaidOut should be 0 before test fails
            if (
                testedContracts[i].balance < (
                    antePool.getTotalChallengerStaked() +
                    antePool.getTotalStaked() +
                    antePool.getTotalPendingWithdraw() -
                    antePool.totalPaidOut()
                )
            )
            {
                return false;
            }
        }
        return true;

        // Not failed
        // contract address value >= challenger + staker + withdraw - totalPaidOut
        // Failed
        // contract address value >= challenger + staker + withdraw - totalPaidOut

        // empty
        // only challenger
        // only staker
        // both challenger, staker
        // unstake some challenger
        // unstake some staker
        // after 1 day, after withdraw happened
        // right after testFailed
        // after challenger claim their portion

    }
}
