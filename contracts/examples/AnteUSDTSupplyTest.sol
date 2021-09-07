// SPDX-License-Identifier: GPL-3.0-only

// ┏━━━┓━━━━━┏┓━━━━━━━━━┏━━━┓━━━━━━━━━━━━━━━━━━━━━━━
// ┃┏━┓┃━━━━┏┛┗┓━━━━━━━━┃┏━━┛━━━━━━━━━━━━━━━━━━━━━━━
// ┃┗━┛┃┏━┓━┗┓┏┛┏━━┓━━━━┃┗━━┓┏┓┏━┓━┏━━┓━┏━┓━┏━━┓┏━━┓
// ┃┏━┓┃┃┏┓┓━┃┃━┃┏┓┃━━━━┃┏━━┛┣┫┃┏┓┓┗━┓┃━┃┏┓┓┃┏━┛┃┏┓┃
// ┃┃ ┃┃┃┃┃┃━┃┗┓┃┃━┫━┏┓━┃┃━━━┃┃┃┃┃┃┃┗┛┗┓┃┃┃┃┃┗━┓┃┃━┫
// ┗┛ ┗┛┗┛┗┛━┗━┛┗━━┛━┗┛━┗┛━━━┗┛┗┛┗┛┗━━━┛┗┛┗┛┗━━┛┗━━┛
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../AnteTest.sol";

// Ante Test to check USDT supply never exceeds M2 (as of May 2021)
contract AnteUSDTSupplyTest is AnteTest("ERC20 Tether (USDT) supply doesn't exceed M2, ~$20T") {
    // https://etherscan.io/address/0xdac17f958d2ee523a2206206994597c13d831ec7#code
    address public constant USDTAddr = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    // As of 2021-05-31, est. M2 monetary supply is ~$20.1086 Trillion USD
    // From https://www.federalreserve.gov/releases/h6/current/default.htm
    // We represent the threshold as 20.1 Trillion * (10 ** USDT Decimals)
    // Or, more simply, 20.1 Trillion = 20,100 Billion

    ERC20 public USDTToken = ERC20(USDTAddr);
    uint256 immutable THRESHOLD_SUPPLY = 20100 * (1000 * 1000 * 1000) * (10**USDTToken.decimals());

    constructor() {
        protocolName = "Tether";
        testedContracts = [USDTAddr];
    }

    function checkTestPasses() public view override returns (bool) {
        return (USDTToken.totalSupply() <= THRESHOLD_SUPPLY);
    }
}
