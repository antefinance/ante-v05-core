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

import "./AntePool.sol";
import "./interfaces/IAnteTest.sol";

contract AntePoolFactory {
    mapping(address => address) public poolMap;
    address[] public allPools;

    event AntePoolCreated(address indexed testAddr, address indexed testPool);

    function createPool(address testAddr) external returns (address testPool) {
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
