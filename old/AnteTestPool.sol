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

import "../interfaces/IAnteTest.sol";

contract AnteTestPool {
    IAnteTest anteTest;
    address public testAddr;
    address public testAuthorAddr;
	//address public factory; //TODO: AnteTestPoolFactory
    bool public pendingFailure; //disable staking, unstaking, challengerStaking
	string public testName; //e.g. SafeMath-Overflow-Test
    uint64 constant DECAY_PER_BLOCK = 100*1e9; //100 GWEI decay per ETH per block is ~20-25% decay per year
    uint256 public lastUpdateHeight;
    uint256 public totalStaking; // total balance staked
    uint256 public totalChallengerStaking; // total balance challengerStaked
    uint256 public totalDecay; //TODO: attribute some of this to test writer
    uint32 public stakerCount;
    uint32 public challengerStakerCount;
    uint256 public totalPayout;
	mapping (address => uint256) public stakingBalanceOf;
	mapping (address => uint256) public challengerStakingBalanceOf;
    event Stake(address staker, uint256 amount);
    event Unstake(address staker, uint256 amount);
    event ChallengerStake(address staker, uint256 amount);
    event ChallengerUnstake(address staker, uint256 amount);
    event TestChecked(address checker);
	event FailureOccurred(address checker);
	event ClaimPaid(address claimer, uint256 amount);

    //TODO: SafeMath subtraction for balances
    //TODO: make public getters for the totalStaking and totalChallengerStaking

    constructor(address _testAddr, address _testAuthorAddr, uint256 initialDeposit, string memory _testName) payable {
        require(initialDeposit > 0, "ANTE: MINIMUM_DEPOSIT");
        require(msg.value == initialDeposit, "ANTE: INITIAL_DEPOSIT_MISMATCH");

        //factory = msg.sender;
        lastUpdateHeight = block.number;
        totalStaking = initialDeposit;
        stakingBalanceOf[msg.sender] = initialDeposit;
        stakerCount = 1;
        totalPayout = 0;

        testName = _testName;
        testAddr = _testAddr;
        testAuthorAddr = _testAuthorAddr;

        //TODO: figureo out what rewards the author gets
        anteTest = IAnteTest(_testAddr);
        pendingFailure = false;
    }

    //accounts for accumulated decay
    function getStakingBalanceOf(address staker) public view returns (uint256) {
        return (stakingBalanceOf[staker] * (totalStaking + totalDecay)) / totalStaking;
    }

    //accounts for accumulated decay
    function getChallengerStakingBalanceOf(address staker) public view returns (uint256) {
        return (challengerStakingBalanceOf[staker] * (totalChallengerStaking - totalDecay)) / totalChallengerStaking;
    }

    //todo: merge stake and challengerStake into one func with bool parameter
    function stake(uint256 amount) external payable {
        require(!pendingFailure, "ANTE: Pending failure, staking frozen.");
        require(msg.value == amount,"ANTE: Deposit amount mismatch.");
        _updateDecay(); // make sure to update other stakers' balances
        if (stakingBalanceOf[msg.sender] == 0) { //has not been counted
            stakerCount += 1;
        }
        totalStaking += amount;
        stakingBalanceOf[msg.sender] += amount;
        emit Stake(msg.sender, amount);
    }

    function unstake(uint256 amount) public {
        require(!pendingFailure, "ANTE: Pending failure, unstaking frozen.");
        uint256 stakeAfterDecay = getStakingBalanceOf(msg.sender);
        require(amount <= stakeAfterDecay, "ANTE: Insufficient Staked Funds");
        _updateDecay();
        // TODO amount can be greater than the staking balance, which impacts future stakes
        stakingBalanceOf[msg.sender] -= amount;
        totalStaking -= amount;
        msg.sender.transfer(amount); // must adjust balance BEFORE transfer
        emit Unstake(msg.sender, amount);
    }

    function challengerStake(uint256 amount) public payable {
        require(!pendingFailure, "ANTE: Pending failure, challengerStaking frozen.");
        require(msg.value == amount,"ANTE: Deposit amount mismatch.");
        _updateDecay();
        if (challengerStakingBalanceOf[msg.sender] == 0) { //has not been counted
            challengerStakerCount += 1;
        }
        totalChallengerStaking += amount;
        challengerStakingBalanceOf[msg.sender] += amount;
        emit ChallengerStake(msg.sender, amount);
    }

    function challengerUnstake(uint256 amount) public {
        _updateDecay();
        // compute the pro-rata portion the challengerstaker controls post decay
        //TODO: SafeMath
        uint256 challengerStakeAfterDecay = getChallengerStakingBalanceOf(msg.sender);
        require(amount <= challengerStakeAfterDecay, "ANTE: Insufficient ChallengerStaked Funds");
        // TODO amount is less than the staking balance since decay is subtracted...
        challengerStakingBalanceOf[msg.sender] -= amount;
        totalChallengerStaking -= amount;
        msg.sender.transfer(amount); // must adjust balance BEFORE transfer
        emit ChallengerUnstake(msg.sender, amount);
    }

    //This is more favorable for a challengerStaker to call because 1) it zeros out the balance and 2) it pays the corresponding bounty
    function claim() public {
        require(pendingFailure, "ANTE: Cannot exit without test failure");
        require(challengerStakingBalanceOf[msg.sender] > 0, "ANTE: Cannot exit with 0 challengerStaking balance.");
        require(totalChallengerStaking > 0, "ANTE: No challengerStaking remains");

        uint256 amount = 0; // todo: calculate the amount paid
        uint256 baseAmount = challengerStakingBalanceOf[msg.sender];
        challengerStakingBalanceOf[msg.sender] = 0; // set to zero to prevent duplicate claims
        amount = baseAmount + (baseAmount * totalStaking) / totalChallengerStaking;
        totalPayout += amount;
        totalChallengerStaking -= amount;
        msg.sender.transfer(amount); // must adjust balance BEFORE transfer
        emit ClaimPaid(msg.sender, amount);

        //todo implement block delay time
        //todo implement EXIT logic that zeros out all unstaking
        //todo: DECIDE HOW MUCH THE CHECKER GETS OF BOUNTY
    }

    function _updateDecay() private {
        //TODO: actually do some math and rebalance all the challengerStaking accts
        //compute total delta of decay
        //math is DECAY_PER_BLOCK*num_eth*num_blocks
        if (pendingFailure) return; //do not update the decay if there is a pending failure
        uint256 block_delta = block.number - lastUpdateHeight;
        if (block_delta >0) {
            uint256 decay_per_eth = DECAY_PER_BLOCK * block_delta;
            // truncate divide by 1e18

            uint256 tempDecay = decay_per_eth * totalChallengerStaking / 1e18;
            totalDecay += tempDecay;

            //update block height
            lastUpdateHeight = block.number;
        }
    }// updates staking balances based on elapsed blocks

	////// ANYONE
    //v0.0.2 design: anyone can call checkTestPasses
    //However, CLAIM on the bounty can only occur if checkTestPasses is at least 6 blocks old but not over 2000 blocks (some reasonable delay)
    //CLAIMer gets a bounty


	// calls test function, sets pendingFailure=True if failed 
	// note: if you are first caller to call this, get bounty via claim
    //TODO: add the caller as a challengerstaker if the check is successful
	function checkTest() public {
		if (pendingFailure) return; // no bounty because already failing
        emit TestChecked(msg.sender);
        _updateDecay(); //update decay one last time
        if (anteTest.checkTestPasses()) {
            pendingFailure = true;

            //TODO: Update the caller as a challengerstaker with 1% credit of staking pool
        }
	}
}
