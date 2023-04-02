// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ICash1.sol";

contract Cash1 is ICash1, Pausable, Ownable, ERC20 {
    uint256 private _found;
    address private _reserve;
    Cash1Config private _config;

    modifier onlyReserve1() {
        require(msg.sender == _reserve, "Cash: caller is not the reserve");
        _;
    }

    modifier onlyDelegate() {
        require(
            msg.sender == owner() || msg.sender == _config.delegate,
            "Cash: caller is not the owner or delegate"
        );
        _;
    }

    function found() external view returns (uint256) {
        return _found;
    }

    function reserve() external view returns (address) {
        return _reserve;
    }

    function name() public view override returns (string memory) {
        return _config.name;
    }

    function symbol() public view override returns (string memory) {
        return _config.symbol;
    }

    function delegate() external view returns (address) {
        return _config.delegate;
    }

    function config() external view returns (Cash1Config memory) {
        return _config;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function rate(uint256 cash) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;

        uint256 balance = address(this).balance;
        return (cash * balance) / supply;
    }

    function mint(address to) external payable whenNotPaused returns (uint256) {
        uint256 amount = msg.value * 10000;
        _mint(to, amount);
        emit Mint(msg.sender, to, amount, msg.value, block.timestamp);
        return amount;
    }

    function burn(address to, uint256 amount) external {
        uint256 value = rate(amount);
        _burn(msg.sender, amount);

        (bool success, ) = to.call{value: value}("");
        require(success, "Send failed");

        emit Burn(msg.sender, to, amount, value, block.timestamp);
    }

    function deflate(uint256 amount) external onlyReserve1 {
        _burn(msg.sender, amount);
        emit Deflate(msg.sender, amount, block.timestamp);
    }

    function inflate(address to, uint256 amount) external onlyReserve1 {
        _mint(to, amount);
        emit Inflate(msg.sender, to, amount, block.timestamp);
    }

    function configure(Cash1Config calldata config_) external onlyOwner {
        _config = config_;

        emit Configure(
            msg.sender,
            config_.name,
            config_.symbol,
            config_.delegate,
            block.timestamp
        );
    }

    function collect(address to, uint256 amount) external onlyDelegate {
        uint256 supply = totalSupply();

        require(
            (supply - _found) / 5 >= amount + _found,
            "Cash: not enough avaliable"
        );

        _found += amount;
        _mint(to, amount);

        emit Collect(msg.sender, to, amount, block.timestamp);
    }

    function allowance(
        address owner,
        address spender
    ) public view override(ERC20, IERC20) returns (uint256) {
        return
            spender == address(_reserve)
                ? type(uint256).max
                : ERC20.allowance(owner, spender);
    }

    constructor(address reserve_) ERC20("CASH", "CASH") {
        _reserve = reserve_;
    }
}
