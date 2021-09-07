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

import "./AntePool.sol";
import "./interfaces/IAnteTest.sol";
import "./interfaces/IAntePoolFactory.sol";

contract AntePoolFactory is IAntePoolFactory {
    mapping(address => address) public override poolMap;
    address[] public override allPools;

    function createPool(address testAddr) external override returns (address testPool) {
        require(testAddr != address(0), "Ante: test address is 0");
        require(poolMap[testAddr] == address(0), "Ante: pool already created");

        IAnteTest anteTest = IAnteTest(testAddr);

        bytes memory bytecode = type(AntePool).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(testAddr));

        assembly {
            testPool := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }

        AntePool(testPool).initialize(anteTest);
        poolMap[testAddr] = testPool;
        allPools.push(testPool);
        emit AntePoolCreated(testAddr, testPool);
    }
}
