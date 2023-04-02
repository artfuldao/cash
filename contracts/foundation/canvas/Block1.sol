// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "../reserve/IReserve1.sol";
import "./Encoding1.sol";

contract Block1 is EArt {
    using Strings for uint;
    using Strings for uint8;
    using Strings for uint64;

    IReserve1 private _reserve;

    function tokenData(Note memory note) external view returns (string memory) {
        return string(_encodeData(note));
    }

    function tokenURI(Note memory note) external view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(_encodeData(note))
                )
            );
    }

    function tokenImage(Note memory) external pure returns (string memory) {
        return "";
    }

    function tokenImageURI(Note memory) external pure returns (string memory) {
        return "";
    }

    function _encodeData(
        Note memory note
    ) internal view virtual returns (bytes memory) {
        return
            abi.encodePacked(
                '{"id":',
                note.id.toString(),
                _encodeNote1(note),
                _encodeNote2(note),
                ',"image":"',
                ""
                '"}'
            );
    }

    function _encodeNote1(
        Note memory note
    ) internal view virtual returns (bytes memory) {
        return
            abi.encodePacked(
                ',"art":',
                note.art.toString(),
                ',"duration":',
                note.duration.toString(),
                ',"createdAt":',
                note.createdAt.toString(),
                ',"collectedAt":',
                note.collectedAt.toString()
            );
    }

    function _encodeNote2(
        Note memory note
    ) internal view virtual returns (bytes memory) {
        uint released = _reserve.getReleased(note.id);
        uint reward = _reserve.getReward(note.id);
        EArt encoder = _reserve.getEncoder(note.id);

        return
            abi.encodePacked(
                ',"delegate":',
                Encoding1.encodeAddress(note.delegate),
                ',"assigned":',
                Encoding1.encodeAddress(address(encoder)),
                ',"encoder":',
                Encoding1.encodeAddress(address(note.encoder)),
                ',"payee":',
                Encoding1.encodeAddress(note.payee),
                ',"released":',
                Encoding1.encodeDecimals(released),
                ',"reward":',
                Encoding1.encodeDecimals(reward),
                ',"amount":',
                Encoding1.encodeDecimals(note.amount),
                ',"rate":',
                note.rate.toString()
            );
    }

    constructor(IReserve1 reserve_) {
        _reserve = reserve_;
    }
}
