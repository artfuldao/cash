// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "../reserve/IReserve1.sol";
import "./Encoding1.sol";
import "./SVG1.sol";

struct Image1 {
    string title;
    string credit;
    string script;
    string webUrl;
    string dataUrl;
    string imageUrl;
    string mediaUrl;
    bytes svgData;
}

contract Canvas1 is SVG1, EArt {
    using Strings for uint;
    using Strings for uint8;
    using Strings for uint64;

    SVG1 private _svg;
    IReserve1 private _reserve;
    mapping(uint => Image1) private _images;

    event Print(
        uint indexed tokenId,
        address indexed from,
        string title,
        string credit,
        string webUrl,
        string dataUrl,
        string imageUrl,
        uint timestamp
    );

    event Update(
        uint indexed tokenId,
        address indexed from,
        string title,
        string credit,
        string webUrl,
        string dataUrl,
        string imageUrl,
        uint timestamp
    );

    function reserve() external view returns (IReserve1) {
        return _reserve;
    }

    function svg() external view returns (SVG1) {
        return _svg;
    }

    function getImage(uint tokenId) external view returns (Image1 memory) {
        return _images[tokenId];
    }

    function print(
        Image1 calldata image,
        NoteParams calldata note
    ) external payable returns (uint) {
        uint tokenId = _reserve.print{value: msg.value}(note);

        _images[tokenId] = image;

        emit Print(
            tokenId,
            msg.sender,
            image.title,
            image.credit,
            image.webUrl,
            image.dataUrl,
            image.imageUrl,
            block.timestamp
        );

        return tokenId;
    }

    function update(
        uint tokenId,
        Image1 calldata image
    ) external payable returns (uint) {
        _images[tokenId] = image;

        emit Update(
            tokenId,
            msg.sender,
            image.title,
            image.credit,
            image.webUrl,
            image.dataUrl,
            image.imageUrl,
            block.timestamp
        );

        return tokenId;
    }

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

    function tokenImage(
        Note memory note
    ) external view returns (string memory) {
        Image1 memory img = _images[note.art];
        return
            img.svgData.length > 0
                ? string(_svg.encodeSVG(img.svgData))
                : img.imageUrl;
    }

    function tokenImageURI(
        Note memory note
    ) external view returns (string memory) {
        Image1 memory img = _images[note.art];
        return
            img.svgData.length > 0
                ? string(_svg.encodeSVGURI(img.svgData))
                : img.imageUrl;
    }

    function _encodeData(
        Note memory note
    ) internal view virtual returns (bytes memory) {
        Image1 memory img = _images[note.art];
        return
            abi.encodePacked(
                '{"id":',
                note.id.toString(),
                _encodeArt1(img),
                _encodeNote1(note),
                _encodeNote2(note),
                _encodeImage1(img),
                _encodeImage2(img),
                '"}'
            );
    }

    function _encodeNote1(
        Note memory note
    ) internal view virtual returns (bytes memory) {
        return
            abi.encodePacked(
                '","art":',
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
                ',"assigned":',
                Encoding1.encodeAddress(address(encoder)),
                ',"encoder":',
                Encoding1.encodeAddress(address(note.encoder)),
                ',"delegate":',
                Encoding1.encodeAddress(note.delegate),
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

    function _encodeImage1(
        Image1 memory img
    ) internal view virtual returns (bytes memory) {
        return
            abi.encodePacked(
                ',"image":"',
                img.svgData.length > 0
                    ? string(_svg.encodeSVGURI(img.svgData))
                    : img.imageUrl
            );
    }

    function _encodeImage2(
        Image1 memory img
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                '","webUrl":"',
                img.webUrl,
                '","dataUrl":"',
                img.dataUrl,
                '","imageUrl":"',
                img.imageUrl,
                '","mediaUrl":"',
                img.mediaUrl,
                '","external_url":"',
                img.webUrl,
                '","animation_url":"',
                img.mediaUrl
            );
    }

    function _encodeArt1(
        Image1 memory img
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                ',"title":"',
                img.title,
                '","credit":"',
                img.credit,
                '","script":"',
                img.script,
                '","description":"',
                img.script
            );
    }

    constructor(IReserve1 reserve_) {
        _reserve = reserve_;
        _svg = new SVG1();
    }
}
