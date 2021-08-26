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
import "@openzeppelin/contracts/utils/Address.sol";

import "./interfaces/IAnteTest.sol";
import "./libraries/IterableSet.sol";
import "./libraries/AnteSafeMath.sol";

contract AntePool {
    using SafeMath for uint256;
    using Address for address;
    using IterableAddressSetUtils for IterableAddressSetUtils.IterableAddressSet;
    using AnteSafeMath for uint256;

    // Info for a single user
    struct UserInfo {
        // How much ETH this user deposited.
        uint256 startAmount;
        // How much decay this side of the pool accrued between (0, this user's
        // entry block), stored as a multiplier expressed as an 18-decimal
        // mantissa. For example, if this side of the pool accrued a decay of
        // 20% during this time period, we'd store 1.2e18 (staking side) or
        // 0.8e18 (challengerstaking side).
        uint256 startDecayMultiplier;
    }
    // Info for one side of the pool.
    struct PoolSideInfo {
        mapping(address => UserInfo) userInfo;
        // Number of users on this side of the pool.
        uint256 numUsers;
        // Amount staked across all users on this side of the pool, as of
        // `lastUpdateBlock`.`
        uint256 totalAmount;
        // How much decay this side of the pool accrued between (0,
        // lastUpdateBlock), stored as a multiplier expressed as an 18-decimal
        // mantissa. For example, if this side of the pool accrued a decay of
        // 20% during this time period, we'd store 1.2e18 (staking side) or
        // 0.8e18 (challengerstaking side).
        uint256 decayMultiplier;
    }

    struct ChallengerEligibilityInfo {
        //used when test fails to determine which challengers should receive payout
        //i.e., those which haven't staked within 12 blocks prior to test failure
        mapping(address => uint256) lastStakedBlock;
        uint256 eligibleAmount;
    }

    // Info about stakers which are currently unstaking
    struct StakerWithdrawInfo {
        mapping(address => UserUnstakeInfo) userUnstakeInfo;
        uint256 totalAmount;
    }

    struct UserUnstakeInfo {
        uint256 lastUnstakeTimestamp;
        uint256 amount;
    }

    // Test for settling this pool.
    IAnteTest public anteTest;
    // AntePoolFactory contract
    address public factory;

    // Whether the test has failed.
    bool public pendingFailure;
    uint256 public numTimesVerified;
    // 5% of stake goes to verifier who successfully triggers negative test
    uint256 constant VERIFIER_BOUNTY = 5;
    // Block number that test failed on (if failed)
    uint256 public failedBlock;
    uint256 public lastVerifiedBlock;
    address public verifier; // address which caused test failure
    // internal convenience variables set on test failure
    uint256 internal _bounty;
    uint256 internal _remainingStake;

    // How many challengerstakers have been paid out.
    uint256 public numPaidOut;
    // Amount that's been paid out in claims.
    uint256 public totalPaidOut;

    // Amount of decay to charge each challengerstaked ETH per block.
    // 100 gwei decay per block per ETH is ~20-25% decay per year
    uint256 constant DECAY_RATE_PER_BLOCK = 100 gwei;

    // number of blocks a challenger must be staking before they are eligible for payout
    // on test failure
    uint8 constant CHALLENGER_BLOCK_DELAY = 12;
    // minimum challenger stake is 0.01 ETH
    uint256 constant MIN_CHALLENGER_STAKE = 1e16;

    // time after initiating withdraw before staker can finally withdraw capital
    uint256 constant UNSTAKE_DELAY = 24 hours;

    // Info for the staking side.
    PoolSideInfo public stakingInfo;
    // Info for the challengerstaking side.
    PoolSideInfo public challengerInfo;
    // Info storing challenger eligibility for payout
    ChallengerEligibilityInfo public eligibilityInfo;
    // all addresses currently staking on challenger side
    IterableAddressSetUtils.IterableAddressSet challengers;
    // Info for stakers trying to withdraw
    StakerWithdrawInfo public withdrawInfo;

    // Block number that `updateDecay` was last called.
    uint256 public lastUpdateBlock;

    event Stake(address staker, uint256 amount, bool isChallenger);
    event Unstake(address staker, uint256 amount, bool isChallenger);
    event TestChecked(address checker);
    event FailureOccurred(address checker);
    event ClaimPaid(address claimer, uint256 amount);
    event WithdrawStake(address staker, uint256 amount);
    event CancelWithdraw(address staker, uint256 amount);

    modifier testNotFailed() {
        _testNotFailed();
        _;
    }

    constructor() {
        factory = msg.sender;
    }

    function initialize(IAnteTest _anteTest) external {
        // check that testAddr is a contract
        require(address(_anteTest).isContract(), "ANTE: AnteTest must be a smart contract");

        anteTest = _anteTest;
        // check that anteTest has checkTestPasses function and that it currently passes
        require(
            anteTest.checkTestPasses(),
            "ANTE: AnteTest either does not implement checkTestPasses or test currently fails"
        );

        stakingInfo.decayMultiplier = AnteSafeMath.ONE;
        challengerInfo.decayMultiplier = AnteSafeMath.ONE;
        lastUpdateBlock = block.number;
    }

    /*****************************************************
     * ================ VIEW FUNCTIONS ================= *
     *****************************************************/

    function getTotalChallengerStaked() external view returns (uint256) {
        return challengerInfo.totalAmount;
    }

    function getTotalStaked() external view returns (uint256) {
        return stakingInfo.totalAmount;
    }

    function getTotalPendingWithdraw() external view returns (uint256) {
        return withdrawInfo.totalAmount;
    }

    function getTotalChallengerEligibleBalance() external view returns (uint256) {
        return eligibilityInfo.eligibleAmount;
    }

    // get challenger payout, if called before test failure returns an estimate
    function getChallengerPayout(address challenger) external view returns (uint256) {
        UserInfo storage user = challengerInfo.userInfo[challenger];
        require(user.startAmount > 0, "ANTE: No Challenger Staking balance");

        if (pendingFailure) {
            return _calculateChallengerPayout(user, challenger);
        } else {
            uint256 amount = _storedBalance(user, challengerInfo);
            uint256 bounty = getVerifierBounty();
            uint256 totalStake = stakingInfo.totalAmount.add(withdrawInfo.totalAmount);

            return amount.add(amount.mulDiv(totalStake.sub(bounty), challengerInfo.totalAmount));
        }
    }

    // get amount held by user up until current block, view function
    function getStoredBalance(address _user, bool isChallenger) external view returns (uint256) {
        (uint256 decayMultiplierThisUpdate, uint256 decayThisUpdate) = _computeDecay();

        UserInfo storage user = isChallenger ? challengerInfo.userInfo[_user] : stakingInfo.userInfo[_user];

        if (user.startAmount == 0) return 0;

        require(user.startDecayMultiplier > 0, "ANTE: Invalid startDecayMultiplier");

        uint256 decayMultiplier;

        if (isChallenger) {
            decayMultiplier = challengerInfo.decayMultiplier.mul(decayMultiplierThisUpdate).div(1e18);
        } else {
            uint256 totalStaked = stakingInfo.totalAmount;
            uint256 totalStakedNew = totalStaked.add(decayThisUpdate);
            decayMultiplier = stakingInfo.decayMultiplier.mul(totalStakedNew).div(totalStaked);
        }

        return user.startAmount.mulDiv(decayMultiplier, user.startDecayMultiplier);
    }

    function getPendingWithdrawAmount(address _user) external view returns (uint256) {
        return withdrawInfo.userUnstakeInfo[_user].amount;
    }

    function getPendingWithdrawAllowedTime(address _user) external view returns (uint256) {
        UserUnstakeInfo storage user = withdrawInfo.userUnstakeInfo[_user];
        require(user.amount > 0, "ANTE: nothing to withdraw");

        return user.lastUnstakeTimestamp.add(UNSTAKE_DELAY);
    }

    function getCheckTestAllowedBlock(address _user) external view returns (uint256) {
        return eligibilityInfo.lastStakedBlock[_user].add(CHALLENGER_BLOCK_DELAY);
    }

    function getUserStartAmount(address _user, bool isChallenger) external view returns (uint256) {
        return isChallenger ? challengerInfo.userInfo[_user].startAmount : stakingInfo.userInfo[_user].startAmount;
    }

    function getVerifierBounty() public view returns (uint256) {
        uint256 totalStake = stakingInfo.totalAmount.add(withdrawInfo.totalAmount);
        return totalStake.mul(VERIFIER_BOUNTY).div(100);
    }

    /*****************************************************
     * ================ USER INTERFACE ================= *
     *****************************************************/

    /// Stake `amount` on the side given by `isChallenger`.
    function stake(bool isChallenger) external payable testNotFailed {
        uint256 amount = msg.value;
        require(amount > 0, "ANTE: Cannot stake zero");

        updateDecay();

        PoolSideInfo storage side;
        if (isChallenger) {
            require(amount >= MIN_CHALLENGER_STAKE, "ANTE: Challenger must stake more than 0.01 ETH");
            side = challengerInfo;

            // record info for future use
            // challengers are not eligible for rewards if challenging within 12 block window of test failure
            challengers.insert(msg.sender);
            eligibilityInfo.lastStakedBlock[msg.sender] = block.number;
        } else {
            side = stakingInfo;
        }

        UserInfo storage user = side.userInfo[msg.sender];

        // Calculate how much the user already has staked, including the
        // effects of any previously accrued decay.
        //   prevAmount = startAmount * decayMultipiler / startDecayMultiplier
        //   newAmount = amount + prevAmount
        if (user.startAmount > 0) {
            user.startAmount = amount.add(_storedBalance(user, side));
        } else {
            user.startAmount = amount;
            side.numUsers = side.numUsers.add(1);
        }
        side.totalAmount = side.totalAmount.add(amount);

        // Reset the startDecayMultiplier for this user, since we've updated
        // the startAmount to include any already-accrued decay.
        user.startDecayMultiplier = side.decayMultiplier;

        emit Stake(msg.sender, amount, isChallenger);
    }

    /// Unstake `amount` on the side given by `isChallenger`.
    function unstake(uint256 amount, bool isChallenger) external testNotFailed {
        require(amount > 0, "ANTE: Cannot unstake 0.");

        updateDecay();

        PoolSideInfo storage side = isChallenger ? challengerInfo : stakingInfo;

        UserInfo storage user = side.userInfo[msg.sender];
        _unstake(amount, isChallenger, side, user);
    }

    // unstake entire user balance
    function unstakeAll(bool isChallenger) external testNotFailed {
        updateDecay();

        PoolSideInfo storage side = isChallenger ? challengerInfo : stakingInfo;

        UserInfo storage user = side.userInfo[msg.sender];

        uint256 amount = _storedBalance(user, side);
        require(amount > 0, "ANTE: Nothing to unstake");

        _unstake(amount, isChallenger, side, user);
    }

    function withdrawStake() external testNotFailed {
        UserUnstakeInfo storage unstakeUser = withdrawInfo.userUnstakeInfo[msg.sender];

        require(
            unstakeUser.lastUnstakeTimestamp < block.timestamp - UNSTAKE_DELAY,
            "ANTE: Staker must wait 24 hours after initiating withdraw to withdraw stake"
        );
        require(unstakeUser.amount > 0, "ANTE: Nothing to withdraw");

        uint256 amount = unstakeUser.amount;
        withdrawInfo.totalAmount = withdrawInfo.totalAmount.sub(amount);
        unstakeUser.amount = 0;

        _safeTransfer(msg.sender, amount);

        emit WithdrawStake(msg.sender, amount);
    }

    // cancel pending withdraw initiated by staker
    function cancelPendingWithdraw() external testNotFailed {
        UserUnstakeInfo storage unstakeUser = withdrawInfo.userUnstakeInfo[msg.sender];

        require(unstakeUser.amount > 0, "ANTE: No pending withdraw balance");
        uint256 amount = unstakeUser.amount;
        unstakeUser.amount = 0;

        updateDecay();

        UserInfo storage user = stakingInfo.userInfo[msg.sender];
        if (user.startAmount > 0) {
            user.startAmount = amount.add(_storedBalance(user, stakingInfo));
        } else {
            user.startAmount = amount;
            stakingInfo.numUsers = stakingInfo.numUsers.add(1);
        }
        stakingInfo.totalAmount = stakingInfo.totalAmount.add(amount);
        user.startDecayMultiplier = stakingInfo.decayMultiplier;

        withdrawInfo.totalAmount = withdrawInfo.totalAmount.sub(amount);

        emit CancelWithdraw(msg.sender, amount);
    }

    /// Run this AnteTestPool's test, triggering a payout if the test fails.
    function checkTest() public {
        if (pendingFailure) return;

        require(challengers.exists(msg.sender), "ANTE: Only challengers can checkTest");
        require(
            block.number.sub(eligibilityInfo.lastStakedBlock[msg.sender]) > CHALLENGER_BLOCK_DELAY,
            "ANTE: must wait 12 blocks after challenging to call checkTest"
        );

        numTimesVerified = numTimesVerified.add(1);
        lastVerifiedBlock = block.number;
        emit TestChecked(msg.sender);
        if (!_checkTestNoRevert()) {
            updateDecay();
            verifier = msg.sender;
            failedBlock = block.number;
            pendingFailure = true;

            _calculateChallengerEligibility();
            _bounty = getVerifierBounty();

            uint256 totalStake = stakingInfo.totalAmount.add(withdrawInfo.totalAmount);
            _remainingStake = totalStake.sub(_bounty);

            emit FailureOccurred(msg.sender);
        }
    }

    function claim() public {
        require(pendingFailure, "ANTE: Test has not failed");

        UserInfo storage user = challengerInfo.userInfo[msg.sender];
        require(user.startAmount > 0, "ANTE: No Challenger Staking balance");

        uint256 amount = _calculateChallengerPayout(user, msg.sender);
        // Zero out the user so they can't claim again.
        user.startAmount = 0;

        numPaidOut = numPaidOut.add(1);
        totalPaidOut = totalPaidOut.add(amount);

        _safeTransfer(msg.sender, amount);
        emit ClaimPaid(msg.sender, amount);
    }

    function updateDecay() public {
        (uint256 decayMultiplierThisUpdate, uint256 decayThisUpdate) = _computeDecay();

        lastUpdateBlock = block.number;

        if (decayThisUpdate == 0) return;

        uint256 totalStaked = stakingInfo.totalAmount;
        uint256 totalChallengerStaked = challengerInfo.totalAmount;

        challengerInfo.decayMultiplier = challengerInfo.decayMultiplier._mul(decayMultiplierThisUpdate);

        challengerInfo.totalAmount = totalChallengerStaked.sub(decayThisUpdate);

        // Update the new accrued decay amounts for stakers.
        //   totalStaked_new = totalStaked_old + decayThisUpdate
        //   decayMultipilerThisUpdate = totalStaked_new / totalStaked_old
        //   decayMultiplier_staker = decayMultiplier_staker * decayMultiplierThisUpdate
        uint256 totalStakedNew = totalStaked.add(decayThisUpdate);

        stakingInfo.decayMultiplier = stakingInfo.decayMultiplier.mulDiv(totalStakedNew, totalStaked);
        stakingInfo.totalAmount = totalStakedNew;
    }

    /*****************************************************
     * =============== INTERNAL HELPERS ================ *
     *****************************************************/

    function _unstake(
        uint256 amount,
        bool isChallenger,
        PoolSideInfo storage side,
        UserInfo storage user
    ) internal {
        // Calculate how much the user has available to unstake, including the
        // effects of any previously accrued decay.
        //   prevAmount = startAmount * decayMultiplier / startDecayMultiplier
        uint256 prevAmount = _storedBalance(user, side);

        if (prevAmount == amount) {
            user.startAmount = 0;
            user.startDecayMultiplier = 0;
            side.numUsers = side.numUsers.sub(1);

            // remove from set of existing challengers
            if (isChallenger) challengers.remove(msg.sender);
        } else {
            require(amount <= prevAmount, "ANTE: Withdraw request exceeds balance.");
            user.startAmount = prevAmount.sub(amount);
            // Reset the startDecayMultiplier for this user, since we've updated
            // the startAmount to include any already-accrued decay.
            user.startDecayMultiplier = side.decayMultiplier;
        }
        side.totalAmount = side.totalAmount.sub(amount);

        if (isChallenger) _safeTransfer(msg.sender, amount);
        else {
            // just initiate the withdraw if staker
            UserUnstakeInfo storage unstakeUser = withdrawInfo.userUnstakeInfo[msg.sender];
            unstakeUser.lastUnstakeTimestamp = block.timestamp;
            unstakeUser.amount = unstakeUser.amount.add(amount);

            withdrawInfo.totalAmount = withdrawInfo.totalAmount.add(amount);
        }

        emit Unstake(msg.sender, amount, isChallenger);
    }

    // function shared by getStoredBalance view function and internal decay computation
    function _computeDecay() internal view returns (uint256 decayMultiplierThisUpdate, uint256 decayThisUpdate) {
        decayThisUpdate = 0;
        decayMultiplierThisUpdate = AnteSafeMath.ONE;

        if (block.number <= lastUpdateBlock) {
            return (decayMultiplierThisUpdate, decayThisUpdate);
        }
        // Stop charging decay if the test already failed.
        if (pendingFailure) {
            return (decayMultiplierThisUpdate, decayThisUpdate);
        }
        // If we have no stakers or challengerstakers, don't charge any decay.
        uint256 totalStaked = stakingInfo.totalAmount;
        uint256 totalChallengerStaked = challengerInfo.totalAmount;
        if (totalStaked == 0 || totalChallengerStaked == 0) {
            return (decayMultiplierThisUpdate, decayThisUpdate);
        }

        uint256 numBlocks = block.number.sub(lastUpdateBlock);

        // Update the new accrued decay amounts for challengerstakers.
        //   decayRateThisUpdate = DECAY_RATE_PER_BLOCK * numBlocks
        //   decayMultiplierThisUpdate = 1 - decayRateThisUpdate
        //   decayMultiplier_challenger = decayMultiplier_challenger * decayMultiplierThisUpdate
        //   decayThisUpdate = totalChallengerStaked * decayRateThisUpdate
        //   totalChallengerStaked = totalChallengerStaked - decayThisUpdate
        uint256 decayRateThisUpdate = DECAY_RATE_PER_BLOCK.mul(numBlocks);

        // failsafe to avoid underflow when calculating decayMultiplierThisUpdate
        if (decayRateThisUpdate >= AnteSafeMath.ONE) {
            decayMultiplierThisUpdate = 0;
            decayThisUpdate = totalChallengerStaked;
        } else {
            decayMultiplierThisUpdate = AnteSafeMath.ONE.sub(decayRateThisUpdate);
            // NOTE: This does the mulDiv and divides by the mantissa
            decayThisUpdate = totalChallengerStaked._mul(decayRateThisUpdate);
        }
    }

    // calculates total amount of challenger capital eligible for payout
    // any challenger which stakes within 12 blocks prior to test failure
    // will not get a payout but will be able to withdraw their capital (minus decay)
    function _calculateChallengerEligibility() internal {
        uint256 cutoffBlock = failedBlock.sub(CHALLENGER_BLOCK_DELAY);
        for (uint256 i = 0; i < challengers.addresses.length; i++) {
            address challenger = challengers.addresses[i];
            if (eligibilityInfo.lastStakedBlock[challenger] < cutoffBlock) {
                // NOTE: this would be a lot simpler if you used solidity 8, which is probably stable by now
                // eligibilityInfo.eligibleAmount +=
                //    _storedBalance(challengerInfo.userInfo[challenger], challengerInfo);
                eligibilityInfo.eligibleAmount = eligibilityInfo.eligibleAmount.add(
                    _storedBalance(challengerInfo.userInfo[challenger], challengerInfo)
                );
            }
        }
    }

    // checks an ante test on an associated contract and also returns false if checkTestPasses reverts
    function _checkTestNoRevert() internal returns (bool) {
        try anteTest.checkTestPasses() returns (bool passes) {
            return passes;
        } catch {
            return false;
        }
    }

    function _calculateChallengerPayout(UserInfo storage user, address challenger) internal view returns (uint256) {
        // Calculate this user's challengerstaking balance.
        uint256 amount = _storedBalance(user, challengerInfo);
        // Calculate how much of the staking pool this user gets, and add that
        // to the user's challengerstaking balance.
        if (eligibilityInfo.lastStakedBlock[challenger] < failedBlock.sub(CHALLENGER_BLOCK_DELAY)) {
            amount = amount.add(amount.mulDiv(_remainingStake, eligibilityInfo.eligibleAmount));
        }

        return challenger == verifier ? amount.add(_bounty) : amount;
    }

    /// Get the amount held by `user`, including accrued decay up to `lastUpdateBlock`.
    function _storedBalance(UserInfo storage user, PoolSideInfo storage side) internal view returns (uint256) {
        if (user.startAmount == 0) return 0;

        require(user.startDecayMultiplier > 0, "ANTE: Invalid startDecayMultiplier");
        return user.startAmount.mulDiv(side.decayMultiplier, user.startDecayMultiplier);
    }

    // Safe transfer function, just in case a rounding error causes the pool to
    // not have enough ETH.
    function _safeTransfer(address payable to, uint256 amount) internal {
        to.transfer(_min(amount, address(this).balance));
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // NOTE: saves contract size by not copying this implementation and the error string in to
    // every function that uses it, only a jump op to this code
    function _testNotFailed() internal {
        require(!pendingFailure, "ANTE: Test already failed.");
    }
}
