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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../AnteTest.sol";

// Ante Test to check if AVL in Ante created Tests drops by 99%
contract AnteAVLDropTest is AnteTest("Ante Doesnt Lose 99% of its AVL") {
    using SafeMath for uint256;

    uint256 public totalAVL;
    uint256 public aVLThreshold;
    
    // contracts deployed with
    constructor (address[] memory _testedContracts) {
        protocolName = "Ante Finance";
        testedContracts = _testedContracts;

        //loop over address and sum up total
        for (uint i = 0; i < testedContracts.length; i++) {
            totalAVL = totalAVL.add(testedContracts[i].balance);
        }
        
        //calculate threshold using 99% drop in total
        aVLThreshold = totalAVL.div(100);
    }
    
    function checkTestPasses() public view override returns (bool) {
        uint256 currentAVL;

        //sum the total
        for (uint i = 0; i < testedContracts.length; i++) {
            currentAVL = currentAVL.add(testedContracts[i].balance);
        }

        //check against threshold
        return currentAVL >= aVLThreshold;
    }
}
