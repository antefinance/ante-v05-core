// SPDX-License-Identifier: GPL-3.0-only

import "./interfaces/IAntePool.sol";

pragma solidity ^0.7.0;

// In the multi stake function. Create a Ante Pool for each address passed.

contract AnteMultiStaking {

    mapping(address => address[]) antePools;

    function multiStake(address[] memory contracts, bool isChallenger) external payable {
        uint256 splitamount = msg.value / contracts.length;

        IAntePool[] memory pools = new IAntePool[](contracts.length);

        for (uint256 i = 0; i < contracts.length; i++) {
            pools[i] = IAntePool(contracts[i]);
            pools[i].stake{value: splitamount}(isChallenger);
        }

        antePools[msg.sender] = contracts;
    }

    function unstake(bool isChallenger) external {
        require(antePools[msg.sender].length > 0, "No ante pools found for this address");

        for (uint256 i = 0; i < antePools[msg.sender].length; i++) {
            IAntePool(antePools[msg.sender][i]).unstakeAll(isChallenger);
        }
    }

    function alwaysTrue() external pure returns(bool) {
        return true;
    }
}