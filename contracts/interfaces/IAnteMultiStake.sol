// SPDX-License-Identifier: GPL-3.0-only

// ┏━━━┓━━━━━┏┓━━━━━━━━━┏━━━┓━━━━━━━━━━━━━━━━━━━━━━━
// ┃┏━┓┃━━━━┏┛┗┓━━━━━━━━┃┏━━┛━━━━━━━━━━━━━━━━━━━━━━━
// ┃┗━┛┃┏━┓━┗┓┏┛┏━━┓━━━━┃┗━━┓┏┓┏━┓━┏━━┓━┏━┓━┏━━┓┏━━┓
// ┃┏━┓┃┃┏┓┓━┃┃━┃┏┓┃━━━━┃┏━━┛┣┫┃┏┓┓┗━┓┃━┃┏┓┓┃┏━┛┃┏┓┃
// ┃┃ ┃┃┃┃┃┃━┃┗┓┃┃━┫━┏┓━┃┃━━━┃┃┃┃┃┃┃┗┛┗┓┃┃┃┃┃┗━┓┃┃━┫
// ┗┛ ┗┛┗┛┗┛━┗━┛┗━━┛━┗┛━┗┛━━━┗┛┗┛┗┛┗━━━┛┗┛┗┛┗━━┛┗━━┛
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pragma solidity ^0.8.0;

interface IAnteMultiStake {

    event ReceivedValue(address sender, uint256 value);
    /// @notice Evenly split the amount of stake between all ante pools
    /// @param contracts A list of contracts to evenly split stake across
    /// @param isChallenger Whether the user is a challenger
    function multiStake(address[] memory contracts, bool isChallenger) external payable;

    /// @notice Unstake all ante pools
    /// @param isChallenger Whether the user is a challenger
    function unstakeall(bool isChallenger) external;

    /// @notice Unstake a specific amount from all ante pools
    /// @param amount The amount to unstake in total
    /// @param isChallenger Whether the user is a challenger
    function unstake(uint256 amount, bool isChallenger) external;

    /// @notice Withdraws funds from stake contract and prepares it so that the user can withdraw it
    function withdrawStakeToContract() external;

    /// @notice Withdraws funds back to user
    function withdrawStakeToUser() external;

    /// @notice Function included for testing purposes. However may be used in the future
    /// @param user User
    /// @return total stake a user has staked
    function getTotalStaked(address user) external view returns (uint256);

    /// @notice Function included for testing purposes. However may be used in the future
    /// @param user User
    /// @return total stake available to withdraw
    function getAvailableToWithdraw(address user) external view returns (uint256);
}
