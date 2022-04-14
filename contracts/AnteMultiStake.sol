// SPDX-License-Identifier: GPL-3.0-only

import "./interfaces/IAntePool.sol";
import "./interfaces/IAnteMultiStake.sol";

pragma solidity ^0.8.0;

contract AnteMultiStaking is IAnteMultiStake {

    mapping(address => address[]) private antePools;

    function multiStake(address[] memory contracts, bool isChallenger) external payable {
        uint256 splitamount = msg.value / contracts.length;

        IAntePool[] memory pools = new IAntePool[](contracts.length);

        for (uint256 i = 0; i < contracts.length; i++) {
            pools[i] = IAntePool(contracts[i]);
            pools[i].stake{value: splitamount}(isChallenger);
        }

        antePools[msg.sender] = contracts;
    }

    function unstakeall(bool isChallenger) external {
        require(antePools[msg.sender].length > 0, "No ante pools found for this address");

        for (uint256 i = 0; i < antePools[msg.sender].length; i++) {
            IAntePool(antePools[msg.sender][i]).unstakeAll(isChallenger);
        }
    }

    function unstake(uint256 amount, bool isChallenger) external {
        require(antePools[msg.sender].length > 0, "No ante pools found for this address");

        for (uint256 i = 0; i < antePools[msg.sender].length; i++) {
            IAntePool(antePools[msg.sender][i]).unstake(amount, isChallenger);
        }
    }
}
