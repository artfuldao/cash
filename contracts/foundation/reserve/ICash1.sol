// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct Cash1Config {
    string name;
    string symbol;
    address delegate;
}

interface ICash1 is IERC20 {
    event Mint(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 value,
        uint256 timestamp
    );

    event Burn(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 value,
        uint256 timestamp
    );

    event Inflate(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    event Deflate(address indexed from, uint256 amount, uint256 timestamp);

    event Configure(
        address indexed from,
        string name,
        string indexed symbol,
        address indexed delegate,
        uint256 timestamp
    );

    event Collect(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    function found() external view returns (uint256);

    function reserve() external view returns (address);

    function config() external view returns (Cash1Config memory);

    function rate(uint256 cash) external view returns (uint256);

    function mint(address to) external payable returns (uint256);

    function burn(address to, uint256 amount) external;

    function inflate(address to, uint256 amount) external;

    function deflate(uint256 amount) external;

    function collect(address to, uint256 amount) external;

    function configure(Cash1Config calldata config) external;
}
