// SPDX-License-Identifier: MIT

// ┏━━━┓━━━━━┏┓━━━━━━━━━┏━━━┓━━━━━━━━━━━━━━━━━━━━━━━
// ┃┏━┓┃━━━━┏┛┗┓━━━━━━━━┃┏━━┛━━━━━━━━━━━━━━━━━━━━━━━
// ┃┗━┛┃┏━┓━┗┓┏┛┏━━┓━━━━┃┗━━┓┏┓┏━┓━┏━━┓━┏━┓━┏━━┓┏━━┓
// ┃┏━┓┃┃┏┓┓━┃┃━┃┏┓┃━━━━┃┏━━┛┣┫┃┏┓┓┗━┓┃━┃┏┓┓┃┏━┛┃┏┓┃
// ┃┃ ┃┃┃┃┃┃━┃┗┓┃┃━┫━┏┓━┃┃━━━┃┃┃┃┃┃┃┗┛┗┓┃┃┃┃┃┗━┓┃┃━┫
// ┗┛ ┗┛┗┛┗┛━┗━┛┗━━┛━┗┛━┗┛━━━┗┛┗┛┗┛┗━━━┛┗┛┗┛┗━━┛┗━━┛
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// code inspired by https://github.com/rob-Hitchens/SetTypes/blob/master/contracts/AddressSet.sol
// updated to solidity 0.7.x

pragma solidity ^0.7.0;

library IterableAddressSetUtils {
    struct IterableAddressSet {
        mapping(address => uint256) indices;
        address[] addresses;
    }

    function insert(IterableAddressSet storage self, address key) internal {
        if (!exists(self, key)) {
            self.addresses.push(key);
            self.indices[key] = self.addresses.length - 1;
        }
    }

    function remove(IterableAddressSet storage self, address key) internal {
        if (!exists(self, key)) {
            return;
        }

        uint256 last = self.addresses.length - 1;
        uint256 indexToReplace = self.indices[key];
        if (indexToReplace != last) {
            address keyToMove = self.addresses[last];
            self.indices[keyToMove] = indexToReplace;
            self.addresses[indexToReplace] = keyToMove;
        }

        delete self.indices[key];
        self.addresses.pop();
    }

    function exists(IterableAddressSet storage self, address key) internal view returns (bool) {
        if (self.addresses.length == 0) return false;

        return self.addresses[self.indices[key]] == key;
    }
}
