// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./ICash1.sol";

struct Reserve1Config {
    string name;
    string symbol;
    address reserve;
    uint32 maxDuration;
    uint32 maxCollection;
    uint32 minCollection;
    uint16 timeDilation;
    uint16 commission;
    uint16 bonus;
}

struct Note {
    EArt encoder;
    uint256 id;
    uint256 art;
    uint256 rate;
    uint256 amount;
    uint256 duration;
    uint256 createdAt;
    uint256 collectedAt;
    address delegate;
    address payee;
}

struct NoteParams {
    EArt encoder;
    address from;
    address to;
    address delegate;
    address payee;
    uint256 amount;
    uint256 duration;
    uint256 target;
}

struct SecureParams {
    uint256 id;
    address delegate;
    address payee;
    EArt encoder;
}

struct RollParams {
    uint256 id;
    address noteTo;
    address interestTo;
    address delegate;
    address payee;
    uint256 target;
    EArt encoder;
}

struct CollectParams {
    uint256 id;
    address interestTo;
    address principalTo;
}

struct WithdrawParams {
    uint256 id;
    uint256 limit;
    address to;
}

interface IArt {
    function tokenURI(uint256 tokenId) external view returns (string memory);

    function tokenData(uint256 tokenId) external view returns (string memory);

    function tokenImage(uint256 tokenId) external view returns (string memory);

    function tokenImageURI(
        uint256 tokenId
    ) external view returns (string memory);
}

interface EArt {
    function tokenURI(Note memory note) external view returns (string memory);

    function tokenData(Note memory note) external view returns (string memory);

    function tokenImage(Note memory note) external view returns (string memory);

    function tokenImageURI(
        Note memory note
    ) external view returns (string memory);
}

interface IReserve1 is IArt, IERC721 {
    event Stake(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 artId,
        uint256 rate,
        uint256 amount,
        uint256 value,
        uint256 duration,
        address payee,
        address delegate,
        EArt encoder,
        uint256 timestamp
    );

    event Secure(
        uint256 indexed tokenId,
        address indexed from,
        EArt indexed encoder,
        address delegate,
        address payee,
        uint256 timestamp
    );

    event Withdraw(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 interest,
        uint256 released,
        uint256 timestamp
    );

    event Collect(
        uint256 indexed tokenId,
        address indexed from,
        address indexed principalTo,
        address interestTo,
        uint256 amount,
        uint256 released,
        uint256 interest,
        uint256 penalty,
        uint256 captured,
        uint256 timestamp
    );

    event Rollover(
        uint256 indexed tokenId,
        uint256 indexed newTokenId,
        address indexed from,
        address noteTo,
        address interestTo,
        uint256 principal,
        uint256 interest,
        uint256 penalty,
        uint256 captured,
        uint256 timestamp
    );

    event Capture(
        uint256 indexed tokenId,
        address indexed from,
        uint256 penalty,
        uint256 captured,
        uint256 timestamp
    );

    event Assign(
        address indexed from,
        uint256 indexed tokenId,
        EArt indexed encoder,
        uint256 timestamp
    );

    event Configure(
        address indexed from,
        string name,
        string symbol,
        address reserve,
        uint32 maxDuration,
        uint32 maxCollection,
        uint32 minCollection,
        uint16 timeDilation,
        uint16 commission,
        uint16 bonus,
        uint256 timestamp
    );

    function cash() external view returns (ICash1);

    function config() external view returns (Reserve1Config memory);

    function pause() external;

    function unpause() external;

    function configure(Reserve1Config calldata config_) external;

    function tokenCount() external view returns (uint256);

    function tokenImage(uint256 tokenId) external view returns (string memory);

    function tokenImageURI(
        uint256 tokenId
    ) external view returns (string memory);

    function tokenData(uint256 tokenId) external view returns (string memory);

    function getNote(uint256 tokenId) external view returns (Note memory);

    function getEncoder(uint256 tokenId) external view returns (EArt);

    function getReward(uint256 tokenId) external view returns (uint256);

    function getReleased(uint256 tokenId) external view returns (uint256);

    function getCaptured(uint256 tokenId) external view returns (uint256);

    function interestRate() external view returns (uint256);

    function print(NoteParams calldata note) external payable returns (uint256);

    function stake(
        uint256 artId,
        NoteParams calldata note
    ) external payable returns (uint256);

    function secure(SecureParams calldata params) external;

    function assign(uint256[] calldata tokenIds, EArt encoder) external;

    function withdraw(
        WithdrawParams calldata params
    ) external returns (uint256);

    function collect(CollectParams calldata params) external;

    function rollover(RollParams calldata params) external returns (uint256);

    function capture(uint256 tokenId) external returns (uint256);

    function captureMany(uint256[] memory tokenIds) external returns (uint256);

    function calculateInterest(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 time
    ) external view returns (uint256);

    function calculatePenalty(
        uint256 amount,
        uint256 duration,
        uint256 time
    ) external view returns (uint256);

    function calculateValue(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 time
    ) external view returns (uint256 interest, uint256 penalty);

    function calculateCollectionWindow(
        uint256 duration
    ) external view returns (uint256);

    function calculateMaximumInterest(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 time
    ) external view returns (uint256);

    function calculateEarlyInterest(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 time
    ) external view returns (uint256);

    function calculateLateInterest(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 remaining
    ) external view returns (uint256);

    function calculateEarlyPenalty(
        uint256 amount,
        uint256 duration,
        uint256 time
    ) external pure returns (uint256);

    function calculateLatePenalty(
        uint256 amount,
        uint256 duration,
        uint256 late
    ) external view returns (uint256);
}
