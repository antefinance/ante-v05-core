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

import "./IAnteTest.sol";

interface IAntePool {
    event Stake(address indexed staker, uint256 amount, bool indexed isChallenger);
    event Unstake(address indexed staker, uint256 amount, bool indexed isChallenger);
    event TestChecked(address indexed checker);
    event FailureOccurred(address indexed checker);
    event ClaimPaid(address indexed claimer, uint256 amount);
    event WithdrawStake(address indexed staker, uint256 amount);
    event CancelWithdraw(address indexed staker, uint256 amount);

    function initialize(IAnteTest _anteTest) external;

    function cancelPendingWithdraw() external;

    function checkTest() external;

    function claim() external;

    function stake(bool isChallenger) external payable;

    function unstake(uint256 amount, bool isChallenger) external;

    function unstakeAll(bool isChallenger) external;

    function updateDecay() external;

    function withdrawStake() external;

    function anteTest() external view returns (IAnteTest);

    function challengerInfo()
        external
        view
        returns (
            uint256 numUsers,
            uint256 totalAmount,
            uint256 decayMultiplier
        );

    function eligibilityInfo() external view returns (uint256 eligibleAmount);

    function factory() external view returns (address);

    function failedBlock() external view returns (uint256);

    function getChallengerPayout(address challenger) external view returns (uint256);

    function getPendingWithdrawAllowedTime(address _user) external view returns (uint256);

    function getPendingWithdrawAmount(address _user) external view returns (uint256);

    function getStoredBalance(address _user, bool isChallenger) external view returns (uint256);

    function getTotalChallengerEligibleBalance() external view returns (uint256);

    function getTotalChallengerStaked() external view returns (uint256);

    function getTotalPendingWithdraw() external view returns (uint256);

    function getTotalStaked() external view returns (uint256);

    function getUserStartAmount(address _user, bool isChallenger) external view returns (uint256);

    function getVerifierBounty() external view returns (uint256);

    function getCheckTestAllowedBlock(address _user) external view returns (uint256);

    function lastUpdateBlock() external view returns (uint256);

    function lastVerifiedBlock() external view returns (uint256);

    function numPaidOut() external view returns (uint256);

    function numTimesVerified() external view returns (uint256);

    function pendingFailure() external view returns (bool);

    function stakingInfo()
        external
        view
        returns (
            uint256 numUsers,
            uint256 totalAmount,
            uint256 decayMultiplier
        );

    function totalPaidOut() external view returns (uint256);

    function verifier() external view returns (address);

    function withdrawInfo() external view returns (uint256 totalAmount);
}
