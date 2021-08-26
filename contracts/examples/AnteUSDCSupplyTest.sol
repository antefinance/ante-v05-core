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

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../AnteTest.sol";

// Ante Test to check USDC supply never exceeds M2 (as of May 2021)
contract AnteUSDCSupplyTest is AnteTest("ERC20 USD Coin (USDC) supply doesn't exceed M2, ~$20T") {
    // https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48#code
    address public constant USDCAddr = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // As of 2021-05-31, est. M2 monetary supply is ~$20.1086 Trillion USD
    // From https://www.federalreserve.gov/releases/h6/current/default.htm
    // We represent the threshold as 20.1 Trillion * (10 ** USDC Decimals)
    // Or, more simply, 20.1 Trillion = 20,100 Billion

    ERC20 public USDCToken = ERC20(USDCAddr);
    uint256 immutable THRESHOLD_SUPPLY = 20100 * (1000 * 1000 * 1000) * (10**USDCToken.decimals());

    constructor() {
        protocolName = "USD Coin";
        testedContracts = [USDCAddr];
    }

    function checkTestPasses() public view override returns (bool) {
        return (USDCToken.totalSupply() <= THRESHOLD_SUPPLY);
    }
}
