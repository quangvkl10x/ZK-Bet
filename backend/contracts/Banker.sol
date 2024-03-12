// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReentrancyGuard.sol";

interface IVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[3] calldata _pubSignals
    ) external returns (bool);
}

contract Banker is ReentrancyGuard {
    address immutable owner;
    uint128 public currentGameId = 0;
    uint8 constant MIN_BET_VALUE = 1;
    uint8 constant MAX_BET_VALUE = 100;
    struct GameState {
        uint256 totalBounty;
        mapping(uint256 => bool) bets;
        mapping(uint8 => address) betSubmitted;
        uint256 deadline;
        uint8 bestBet;
        address winner;
    }
    mapping(uint128 => GameState) game;
    address immutable verifier;

    constructor(address _verifier) {
        owner = msg.sender;
        verifier = _verifier;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function getBounty() public view returns (uint256) {
        return address(this).balance;
    }

    function createGame() public onlyOwner {
        // Create a new game
        currentGameId++;
        game[currentGameId].deadline = block.timestamp + 1 minutes;
        game[currentGameId].totalBounty = address(this).balance;
        game[currentGameId].bestBet = MAX_BET_VALUE;
    }

    function submitBet(uint256 y) public payable nonReentrant {
        require(msg.value == 0.1 ether, "You must bet 0.1 ether");
        require(
            block.timestamp < game[currentGameId].deadline,
            "The game is over"
        );
        game[currentGameId].totalBounty += msg.value;
        game[currentGameId].bets[y] = true;
    }

    function submitProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata input
    ) public payable nonReentrant {
        require(
            block.timestamp > game[currentGameId].deadline && block.timestamp < game[currentGameId].deadline + 1 minutes,
            "The game is not over"
        );
        uint256 x = input[0];
        uint256 y = input[1];
        require(
            game[currentGameId].betSubmitted[uint8(x)] == address(0),
            "Bet already submitted"
        );
        require(x > MIN_BET_VALUE && x < MAX_BET_VALUE, "Invalid bet");
        uint256 _addr = uint256(uint160(msg.sender));
        (bool verifyOK, ) = verifier.call(
            abi.encodeCall(IVerifier.verifyProof, (a, b, c, [x, y, _addr]))
        );
        require(verifyOK, "Invalid proof");
        game[currentGameId].betSubmitted[uint8(x)] = msg.sender;
        if (game[currentGameId].bestBet > uint8(x)) {
            game[currentGameId].bestBet = uint8(x);
            game[currentGameId].winner = msg.sender;
        }
    }

    function claimReward() public nonReentrant {
        require(
            block.timestamp > game[currentGameId].deadline + 1 minutes,
            "The game is not over"
        );
        require(
            game[currentGameId].betSubmitted[game[currentGameId].bestBet] ==
                msg.sender,
            "You are not the winner"
        );
        uint8 bet = game[currentGameId].bestBet;
        uint8 remainder = bet - MIN_BET_VALUE;
        uint256 reward = (game[currentGameId].totalBounty * remainder) / 100;

        payable(msg.sender).transfer(reward);
    }
}
