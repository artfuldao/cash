// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

library Encoding1 {
    using Strings for uint;

    function encodeDecimals(uint num) internal pure returns (bytes memory) {
        bytes memory decimals = bytes((num % 1e18).toString());
        uint length = decimals.length;

        for (uint i = length; i < 18; i += 1) {
            decimals = abi.encodePacked("0", decimals);
        }

        return abi.encodePacked((num / 1e18).toString(), ".", decimals);
    }

    function encodeAddress(address addr) internal pure returns (bytes memory) {
        if (addr == address(0)) return "null";
        return abi.encodePacked('"', uint(uint160(addr)).toHexString(), '"');
    }
}
