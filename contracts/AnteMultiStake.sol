// SPDX-License-Identifier: GPL-3.0-only

import "./interfaces/IAntePool.sol";
import "./interfaces/IAnteMultiStake.sol";

pragma solidity ^0.8.0;

/// @title Ante Multi Stake
contract AnteMultiStaking is IAnteMultiStake {

    mapping(address => address[]) private antePools;
    mapping(address => uint256) private totalStaked;
    mapping(address => uint256) private availableToWithdraw;
    mapping(address => uint256) private pendingWithdrawals;

    receive() external payable {
        emit ReceivedValue(msg.sender, msg.value);
    }

    /// @notice Evenly split the amount of stake between all ante pools
    /// @param contracts A list of contracts to evenly split stake across
    /// @param isChallenger Whether the user is a challenger
    function multiStake(address[] memory contracts, bool isChallenger) external payable {
        uint256 splitamount = msg.value / contracts.length;

        IAntePool[] memory pools = new IAntePool[](contracts.length);

        for (uint256 i = 0; i < contracts.length; i++) {
            pools[i] = IAntePool(contracts[i]);
            pools[i].stake{value: splitamount}(isChallenger);
        }

        antePools[msg.sender] = contracts;
        totalStaked[msg.sender] += msg.value;
    }

    /// @notice Unstake all ante pools
    /// @param isChallenger Whether the user is a challenger
    function unstakeall(bool isChallenger) external {
        require(antePools[msg.sender].length > 0, "No ante pools found for this address");

        for (uint256 i = 0; i < antePools[msg.sender].length; i++) {
            IAntePool(antePools[msg.sender][i]).unstakeAll(isChallenger);
        }

        pendingWithdrawals[msg.sender] += totalStaked[msg.sender];
        totalStaked[msg.sender] = 0;
    }

    /// @notice Unstake a specific amount from all ante pools
    /// @param amount The amount to unstake in total
    /// @param isChallenger Whether the user is a challenger
    function unstake(uint256 amount, bool isChallenger) external {
        require(antePools[msg.sender].length > 0, "No ante pools found for this address");

        uint256 splitamount = amount / antePools[msg.sender].length;

        for (uint256 i = 0; i < antePools[msg.sender].length; i++) {
            IAntePool(antePools[msg.sender][i]).unstake(splitamount, isChallenger);
        }

        pendingWithdrawals[msg.sender] += amount;
        totalStaked[msg.sender] -= amount;
    }

    /// @notice Withdraws funds from stake contract and prepares it so that the user can withdraw it
    function withdrawStakeToContract() external {
        require(antePools[msg.sender].length > 0, "No ante pools found for this address");

        for (uint256 i = 0; i < antePools[msg.sender].length; i++) {
            IAntePool(antePools[msg.sender][i]).withdrawStake();
        }

        availableToWithdraw[msg.sender] += pendingWithdrawals[msg.sender];
        pendingWithdrawals[msg.sender] = 0;
    }

    /// @notice Withdraws funds back to user
    function withdrawStakeToUser() external {
        _safeTransfer(payable(msg.sender), availableToWithdraw[msg.sender]);
    }

    /// @notice Function included for testing purposes. However may be used in the future
    /// @return total stake a user has staked
    function getTotalStaked() external view returns (uint256) {
        return totalStaked[msg.sender];
    }

    /// @notice Function included for testing purposes. However may be used in the future
    /// @return total stake available to withdraw
    function getAvailableToWithdraw() external view returns (uint256) {
        return availableToWithdraw[msg.sender];
    }

    /// @notice Transfers funds to a user
    /// @param to The address to transfer funds to
    /// @param amount The amount to transfer
    function _safeTransfer(address payable to, uint256 amount) internal {
        to.transfer(_min(amount, address(this).balance));
    }

    /// @notice Returns the higher of 2 parameters
    /// @param a Value A
    /// @param b Value B
    /// @return higher of a or b
    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /// @notice Returns the lower of 2 parameters
    /// @param a Value A
    /// @param b Value B
    /// @return lower of a or b
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
