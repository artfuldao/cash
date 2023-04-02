// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./Encoding1.sol";

contract SVG1 {
    using Strings for uint;
    using Strings for uint8;
    using Strings for uint16;
    using Strings for uint64;

    function encodeSVG(bytes calldata svg) public pure returns (string memory) {
        return string(_encodeSVG(svg));
    }

    function encodeSVGURI(
        bytes calldata svg
    ) public pure virtual returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "data:image/svg+xml;base64,",
                    Base64.encode(_encodeSVG(svg))
                )
            );
    }

    function _encodeSVG(bytes calldata svg) public pure returns (bytes memory) {
        return
            abi.encodePacked(
                '<svg width="512" height="512" viewBox="0 0 255 255" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">',
                string(_encodeSVGShapes(svg)),
                "</svg>"
            );
    }

    function _encodeRectangle(
        bytes calldata svg
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                '<rect width="',
                uint8(svg[0]).toString(),
                '" height="',
                uint8(svg[1]).toString(),
                '" x="',
                uint8(svg[2]).toString(),
                '" y="',
                uint8(svg[3]).toString()
            );
    }

    function _encodeEllipse(
        bytes calldata svg
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                '<ellipse cx="',
                uint8(svg[0]).toString(),
                '" cy="',
                uint8(svg[1]).toString(),
                '" rx="',
                uint8(svg[2]).toString(),
                '" ry="',
                uint8(svg[3]).toString()
            );
    }

    function _encodeLine(
        bytes calldata svg
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                '<line x1="',
                uint8(svg[0]).toString(),
                '" y1="',
                uint8(svg[1]).toString(),
                '" x2="',
                uint8(svg[2]).toString(),
                '" y2="',
                uint8(svg[3]).toString()
            );
    }

    function _encodeRotate(
        bytes calldata svg
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                '" transform="rotate(',
                uint16(bytes2(svg[0:2])).toString(),
                ", ",
                uint8(svg[2]).toString(),
                ", ",
                uint8(svg[3]).toString(),
                ")"
            );
    }

    function _encodeStroke(
        bytes calldata svg
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                '" stroke="',
                _encodeColor(svg),
                '" stroke-linecap="round" stroke-width="',
                uint8(svg[4]).toString()
            );
    }

    function _encodeFill(
        bytes calldata svg
    ) internal pure returns (bytes memory) {
        return abi.encodePacked('" fill="', _encodeColor(svg));
    }

    function _encodeColor(
        bytes calldata svg
    ) internal pure returns (bytes memory) {
        uint8 alpha = uint8(svg[3]);
        bytes memory channel;

        if (alpha >= 100) channel = "1";
        else channel = abi.encodePacked("0.", alpha.toString());

        return
            abi.encodePacked(
                "rgba(",
                uint8(svg[0]).toString(),
                ",",
                uint8(svg[1]).toString(),
                ",",
                uint8(svg[2]).toString(),
                ",",
                channel,
                ")"
            );
    }

    function _encodeSVGShapes(
        bytes calldata svg
    ) internal pure returns (bytes memory) {
        bytes memory out;

        uint8 code = uint8(svg[0]);
        uint8 shape = code / 8;
        uint8 mode = code % 8;

        if (shape == 0) {
            out = _encodeEllipse(svg[1:]);
        }
        if (shape == 1) {
            out = _encodeRectangle(svg[1:]);
        }
        if (shape == 2) {
            out = _encodeLine(svg[1:]);
        }

        uint256 next = 5;

        if (mode < 4) {
            out = abi.encodePacked(out, _encodeFill(svg[next:]));
            next += 4;

            if (mode % 2 == 1) {
                out = abi.encodePacked(out, _encodeStroke(svg[next:]));
                next += 5;
            }

            if (mode > 1) {
                out = abi.encodePacked(out, _encodeRotate(svg[next:]));
                next += 4;
            }
        } else {
            out = abi.encodePacked(out, _encodeStroke(svg[next:]));
            next += 5;

            if (mode == 5) {
                out = abi.encodePacked(out, _encodeRotate(svg[next:]));
                next += 4;
            }
        }

        out = abi.encodePacked(out, '"/>');

        if (svg.length > next) {
            return abi.encodePacked(out, _encodeSVGShapes(svg[next:]));
        }

        return out;
    }
}
