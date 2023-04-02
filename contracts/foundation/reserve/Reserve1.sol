// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IReserve1.sol";
import "./Cash1.sol";

contract Reserve1 is IReserve1, Ownable, Pausable, ERC721 {
    Cash1 private _cash;

    uint256 private _tokenCount;

    Reserve1Config private _config =
        Reserve1Config({
            name: "ARTFUL Note",
            symbol: "ARTFUL NOTE",
            commission: 1200,
            bonus: 11000,
            maxDuration: 5550 days,
            maxCollection: 333 days,
            minCollection: 3 days,
            timeDilation: 3,
            reserve: address(0)
        });

    mapping(uint256 => Note) private _notes;
    mapping(uint256 => EArt) private _encoders;
    mapping(uint256 => uint256) private _rewards;
    mapping(uint256 => uint256) private _releases;
    mapping(uint256 => uint256) private _captures;

    function cash() external view returns (ICash1) {
        return _cash;
    }

    function config() external view returns (Reserve1Config memory) {
        return _config;
    }

    function name() public view override returns (string memory) {
        return _config.name;
    }

    function symbol() public view override returns (string memory) {
        return _config.symbol;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function configure(Reserve1Config calldata config_) external onlyOwner {
        require(
            _config.commission <= 3333,
            "Reserve: commission out of bounds"
        );

        require(
            _config.bonus >= 10000 && _config.bonus <= 13333,
            "Reserve: bonus out of bounds"
        );

        _config = config_;

        emit Configure(
            msg.sender,
            _config.name,
            _config.symbol,
            _config.reserve,
            _config.maxDuration,
            _config.maxCollection,
            _config.minCollection,
            _config.timeDilation,
            _config.commission,
            _config.bonus,
            block.timestamp
        );
    }

    function tokenCount() external view returns (uint256) {
        return _tokenCount;
    }

    function tokenImage(uint256 tokenId) external view returns (string memory) {
        Note memory note;
        EArt encoder;
        (note, encoder) = _requireEncoder(tokenId);
        return encoder.tokenImage(note);
    }

    function tokenImageURI(
        uint256 tokenId
    ) external view returns (string memory) {
        Note memory note;
        EArt encoder;
        (note, encoder) = _requireEncoder(tokenId);
        return encoder.tokenImageURI(note);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, IArt) returns (string memory) {
        Note memory note;
        EArt encoder;
        (note, encoder) = _requireEncoder(tokenId);
        return encoder.tokenURI(note);
    }

    function tokenData(uint256 tokenId) external view returns (string memory) {
        Note memory note;
        EArt encoder;
        (note, encoder) = _requireEncoder(tokenId);
        return encoder.tokenData(note);
    }

    function getNote(uint256 tokenId) external view returns (Note memory) {
        return _notes[tokenId];
    }

    function getEncoder(uint256 tokenId) external view returns (EArt) {
        return _encoders[tokenId];
    }

    function getReward(uint256 tokenId) external view returns (uint256) {
        return _rewards[tokenId];
    }

    function getReleased(uint256 tokenId) external view returns (uint256) {
        return _releases[tokenId];
    }

    function getCaptured(uint256 tokenId) external view returns (uint256) {
        return _captures[tokenId];
    }

    function interestRate() public view returns (uint256) {
        uint256 staked = _cash.balanceOf(address(this));
        uint256 supply = _cash.totalSupply();

        if (supply == 0) return 33333;
        uint256 rate = (33000 * staked) / supply;
        rate = (rate * staked) / supply;
        return rate + 333;
    }

    function print(
        NoteParams calldata note
    ) external payable whenNotPaused returns (uint256) {
        uint256 principal = _stake(note);
        uint256 tokenId = _create(0, principal, note);
        return tokenId;
    }

    function stake(
        uint256 artId,
        NoteParams calldata note
    ) external payable whenNotPaused returns (uint256) {
        _requirePrint(artId);
        uint256 principal = _stake(note);
        return _create(artId, principal, note);
    }

    function secure(SecureParams calldata params) external {
        Note storage note = _notes[params.id];

        require(
            ownerOf(params.id) == msg.sender || note.delegate == msg.sender,
            "Reserve: caller is not the owner or delegate"
        );

        note.encoder = params.encoder;
        note.delegate = params.delegate;
        note.payee = params.payee;

        emit Secure(
            params.id,
            msg.sender,
            params.encoder,
            params.delegate,
            params.payee,
            block.timestamp
        );
    }

    function assign(
        uint256[] calldata tokenIds,
        EArt encoder
    ) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i += 1) {
            uint256 tokenId = tokenIds[i];
            _encoders[tokenId] = encoder;

            emit Assign(msg.sender, tokenId, encoder, block.timestamp);
        }
    }

    function withdraw(
        WithdrawParams calldata params
    ) external returns (uint256) {
        Note memory note = _requireMyNote(params.id);

        uint256 time = block.timestamp - note.createdAt;
        uint256 interest = calculateInterest(
            note.rate,
            note.amount,
            note.duration,
            time
        );

        uint256 release = _release(
            params.id,
            note.art,
            interest,
            params.limit,
            false
        );

        _cash.inflate(params.to, release);

        emit Withdraw(
            params.id,
            msg.sender,
            params.to,
            interest,
            release,
            block.timestamp
        );

        return release;
    }

    function collect(CollectParams calldata params) external {
        Note storage note = _requireOpenNote(params.id);
        uint256 time = block.timestamp - note.createdAt;

        if (time < note.duration) {
            require(
                msg.sender == ownerOf(params.id),
                "Reserve: caller does not have permission"
            );
        } else {
            require(
                msg.sender == ownerOf(params.id) ||
                    msg.sender == note.delegate ||
                    (params.principalTo == note.payee &&
                        params.interestTo == note.payee),
                "Reserve: caller does not have permission"
            );
        }

        uint256 interest;
        uint256 penalty;
        (interest, penalty) = calculateValue(
            note.rate,
            note.amount,
            note.duration,
            time
        );

        uint256 released = _release(
            params.id,
            note.art,
            interest,
            0,
            penalty == 0
        );

        uint256 captured = _capture(params.id, penalty);
        uint256 payment = note.amount - penalty;
        note.collectedAt = block.timestamp;

        if (payment > 0) _cash.transfer(params.principalTo, payment);
        if (released > 0) _cash.inflate(params.interestTo, released);
        if (captured > 0) _deflate(captured);

        emit Collect(
            params.id,
            msg.sender,
            params.principalTo,
            params.interestTo,
            note.amount,
            released,
            interest,
            penalty,
            captured,
            block.timestamp
        );
    }

    function rollover(
        RollParams calldata params
    ) external whenNotPaused returns (uint256) {
        Note storage note = _requireMyNote(params.id);
        uint256 time = block.timestamp - note.createdAt;

        require(
            time > note.duration,
            "Reserve: note is not ready for rollover"
        );

        uint256 interest;
        uint256 penalty;
        (interest, penalty) = calculateValue(
            note.rate,
            note.amount,
            note.duration,
            time
        );

        uint256 released = _release(
            params.id,
            note.art,
            interest,
            0,
            penalty == 0
        );

        uint256 captured = _capture(params.id, penalty);
        uint256 principal = note.amount - penalty;

        if (params.interestTo == address(0)) {
            if (released > captured) {
                _cash.inflate(address(this), released - captured);
            } else if (captured > released) {
                _deflate(captured - released);
            }
            principal += released;
        } else {
            if (released > captured) {
                _cash.inflate(params.interestTo, released - captured);
            } else if (captured > released) {
                _deflate(captured - released);
            }
        }

        note.collectedAt = block.timestamp;
        uint256 tokenId = _create(
            note.art,
            principal,
            NoteParams({
                encoder: params.encoder,
                from: msg.sender,
                to: params.noteTo,
                target: params.target,
                delegate: params.delegate,
                payee: params.payee,
                amount: principal,
                duration: note.duration
            })
        );

        emit Rollover(
            tokenId,
            tokenId,
            msg.sender,
            params.noteTo,
            params.interestTo,
            principal,
            interest,
            penalty,
            captured,
            block.timestamp
        );

        return tokenId;
    }

    function capture(uint256 tokenId) public returns (uint256) {
        Note storage note = _requireOpenNote(tokenId);

        uint256 time = block.timestamp - note.createdAt;
        uint256 window = calculateCollectionWindow(note.duration);
        uint256 buffer = note.duration + window;

        require(time >= buffer, "Reserve: note is not expiring");
        uint256 penalty = note.duration == 0
            ? 0
            : calculateLatePenalty(note.amount, note.duration, time - buffer);

        uint256 captured = _capture(tokenId, penalty);
        if (captured > 0) _deflate(captured);

        emit Capture(tokenId, msg.sender, penalty, captured, block.timestamp);

        return penalty;
    }

    function captureMany(uint256[] memory tokenIds) public returns (uint256) {
        uint256 captured = 0;
        for (uint256 i = 0; i < tokenIds.length; i += 1) {
            captured += capture(tokenIds[i]);
        }
        return captured;
    }

    function calculateInterest(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 time
    ) public view returns (uint256) {
        if (amount == 0) return 0;
        if (duration == 0) return 0;
        if (time == 0) return 0;

        if (time < duration) {
            return calculateEarlyInterest(rate, amount, duration, time);
        }

        uint256 expires = duration + calculateCollectionWindow(duration);

        if (time > expires) {
            uint256 remaining = time - expires;
            return calculateLateInterest(rate, amount, duration, remaining);
        }

        return calculateMaximumInterest(rate, amount, duration, duration);
    }

    function calculatePenalty(
        uint256 amount,
        uint256 duration,
        uint256 time
    ) public view returns (uint256) {
        if (amount == 0) return 0;
        if (duration == 0) return 0;
        if (time == 0) return amount;

        if (time < duration) {
            return calculateEarlyPenalty(amount, duration, time);
        }

        uint256 expires = duration + calculateCollectionWindow(duration);

        if (time > expires) {
            uint256 remaining = time - expires;
            return calculateLatePenalty(amount, duration, remaining);
        }

        return 0;
    }

    function calculateValue(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 time
    ) public view returns (uint256 interest, uint256 penalty) {
        if (amount == 0) return (0, 0);
        if (duration == 0) return (0, 0);
        if (time == 0) return (0, amount);

        if (time < duration) {
            return (
                calculateEarlyInterest(rate, amount, duration, time),
                calculateEarlyPenalty(amount, duration, time)
            );
        }

        uint256 expires = duration + calculateCollectionWindow(duration);

        if (time > expires) {
            uint256 late = time - expires;
            return (
                calculateLateInterest(rate, amount, duration, late),
                calculateLatePenalty(amount, duration, late)
            );
        }

        return (calculateMaximumInterest(rate, amount, duration, duration), 0);
    }

    function calculateCollectionWindow(
        uint256 duration
    ) public view returns (uint256) {
        uint256 window = duration / _config.timeDilation;
        if (window < _config.minCollection) return _config.minCollection;
        if (window > _config.maxCollection) return _config.maxCollection;
        return window;
    }

    function calculateMaximumInterest(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 time
    ) public view returns (uint256) {
        uint256 payment = amount;

        payment = (payment * time) / _config.maxDuration;
        payment = (((payment * 25) / 2) * rate) / 10000;

        uint256 reward = (payment * duration) / _config.maxDuration;
        reward = (reward * 33333) / 10000;

        return payment + reward;
    }

    function calculateEarlyInterest(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 time
    ) public view returns (uint256) {
        uint256 payment = calculateMaximumInterest(
            rate,
            amount,
            duration,
            time
        );
        return (payment * time) / duration;
    }

    function calculateLateInterest(
        uint256 rate,
        uint256 amount,
        uint256 duration,
        uint256 remaining
    ) public view returns (uint256) {
        uint256 total = duration / _config.timeDilation;
        if (total < remaining) return 0;

        uint256 left = total - remaining;
        uint256 payment = calculateMaximumInterest(rate, amount, total, left);

        payment = (payment * left) / total;
        payment = (payment * left) / total;

        return _config.timeDilation * payment;
    }

    function calculateEarlyPenalty(
        uint256 amount,
        uint256 duration,
        uint256 time
    ) public pure returns (uint256) {
        return amount - (amount * time) / duration;
    }

    function calculateLatePenalty(
        uint256 amount,
        uint256 duration,
        uint256 late
    ) public view returns (uint256) {
        uint256 penalty = (_config.timeDilation * amount * late) / duration;
        return penalty > amount ? amount : penalty;
    }

    function _create(
        uint256 artId,
        uint256 principal,
        NoteParams memory params
    ) internal returns (uint256) {
        require(
            params.duration <= _config.maxDuration,
            "Reserve: duration is too long"
        );

        uint256 rate = interestRate();
        require(
            params.target == 0 || rate >= params.target,
            "Reserve: interest rate was below the goal"
        );

        Note storage note = _notes[++_tokenCount];
        uint256 art = artId == 0 ? _tokenCount : artId;

        note.art = art;
        note.id = _tokenCount;
        note.amount = principal;
        note.rate = rate;
        note.payee = params.payee;
        note.encoder = params.encoder;
        note.duration = params.duration;
        note.delegate = params.delegate;
        note.createdAt = block.timestamp;

        _safeMint(params.to, _tokenCount);

        emit Stake(
            _tokenCount,
            params.from,
            params.to,
            art,
            rate,
            params.amount,
            msg.value,
            params.duration,
            params.payee,
            params.delegate,
            params.encoder,
            block.timestamp
        );

        return _tokenCount;
    }

    function _stake(NoteParams memory params) internal returns (uint256) {
        uint256 principal = params.amount;

        if (principal > 0) {
            _cash.transferFrom(params.from, address(this), principal);
        }

        if (msg.value > 0) {
            principal += _cash.mint{value: msg.value}(address(this));
        }

        return principal;
    }

    function _release(
        uint256 tokenId,
        uint256 artId,
        uint256 interest,
        uint256 limit,
        bool multiple
    ) internal returns (uint256) {
        uint256 avaliable = interest;

        if (multiple) {
            avaliable = (_config.bonus * avaliable) / 10000;
        }

        avaliable += _rewards[tokenId];

        uint256 released = _releases[tokenId];
        if (released > avaliable) return 0;

        uint256 amount = avaliable - released;
        if (limit != 0 && amount > limit) {
            amount = limit;
        }

        _releases[tokenId] += amount;

        if (artId != tokenId) {
            _rewards[artId] += (_config.commission * amount) / 10000;
        }

        return amount;
    }

    function _capture(
        uint256 tokenId,
        uint256 penalty
    ) internal returns (uint256) {
        uint256 captured;

        if (penalty > 0) {
            uint256 current = _captures[tokenId];

            if (penalty > current) {
                captured = penalty - current;
                _captures[tokenId] += captured;
            }
        }

        return captured;
    }

    function _deflate(uint256 amount) internal {
        if (address(_config.reserve) == address(0)) {
            _cash.deflate(amount);
        } else {
            _cash.transfer(_config.reserve, amount);
        }
    }

    function _requireTokenId(uint256 tokenId) internal view {
        require(
            tokenId > 0 && tokenId <= _tokenCount,
            "Reserve: invalid token ID"
        );
    }

    function _requireOpenNote(
        uint256 tokenId
    ) internal view returns (Note storage) {
        _requireTokenId(tokenId);
        Note storage note = _notes[tokenId];
        require(note.collectedAt == 0, "Reserve: note has been collected");
        return note;
    }

    function _requireMyNote(
        uint256 tokenId
    ) internal view returns (Note storage) {
        Note storage note = _requireOpenNote(tokenId);
        require(
            msg.sender == ownerOf(tokenId) || msg.sender == note.delegate,
            "Reserve: caller does not have permission"
        );
        return note;
    }

    function _requirePrint(
        uint256 tokenId
    ) internal view returns (Note memory) {
        _requireTokenId(tokenId);
        Note memory token = _notes[tokenId];
        require(token.art == token.id, "Reserve: Art is not a print");
        return token;
    }

    function _requireEncoder(
        uint256 tokenId
    ) internal view returns (Note memory, EArt) {
        _requireTokenId(tokenId);

        EArt encoder = _encoders[tokenId];
        Note memory note = _notes[tokenId];

        if (address(encoder) == address(0)) {
            return (note, note.encoder);
        }

        return (note, encoder);
    }

    function _afterTokenTransfer(
        address from,
        address,
        uint256 tokenId,
        uint256
    ) internal override {
        if (from != address(0)) {
            Note storage note = _notes[tokenId];
            note.delegate = address(0);
            note.payee = address(0);
        }
    }

    constructor() ERC721("", "") {
        _cash = new Cash1(address(this));
        _cash.transferOwnership(msg.sender);
    }
}
