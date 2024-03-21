// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ReentrancyGuard.sol";

interface IVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[2] calldata _pubSignals
    ) external returns (bool);
}

contract Banker is ReentrancyGuard {
    uint256 public currentGameId = 0;
    struct Game {
        uint256 totalBounty;
        mapping(uint256 => address) bets;
        mapping(uint256 => address) betSubmitted;
        uint256 betDeadline;
        uint256 betDuration;
        uint256 submitProofDeadline;
        uint256 submitProofDuration;
        uint256 betAmount;
        uint256 minBetValue;
        uint256 maxBetValue;
        uint256 bestBet;
        address winner;
        address owner;
        bool claimed;
    }
    mapping(uint256 => Game) game;
    address immutable verifier;

    constructor(address _verifier) {
        verifier = _verifier;
    }

    function getGame(
        uint256 gameId
    )
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            address,
            address,
            bool
        )
    {
        require(gameId <= currentGameId, "Invalid game id");
        Game storage g = game[gameId];
        return (
            g.totalBounty,
            g.betDeadline,
            g.betDuration,
            g.submitProofDeadline,
            g.submitProofDuration,
            g.betAmount,
            g.minBetValue,
            g.maxBetValue,
            g.bestBet,
            g.winner,
            g.owner,
            g.claimed
        );
    }

    function getActiveGames() public view returns (uint256[] memory) {
        uint256[] memory activeGames;
        uint256 count = 0;
        for (uint256 i = 1; i <= currentGameId; i++) {
            if (block.timestamp < game[i].submitProofDeadline) {
                activeGames[count] = i;
                count++;
            }
        }
        return activeGames;
    }

    function getRemainingTime(
        uint256 gameId
    ) public view returns (uint256[2] memory) {
        require(gameId <= currentGameId, "Invalid game id");
        if (block.timestamp < game[gameId].betDeadline)
            return [game[gameId].betDeadline - block.timestamp, 0];
        else if (block.timestamp < game[gameId].submitProofDeadline)
            return [game[gameId].submitProofDeadline - block.timestamp, 1];
        return [uint256(0), uint256(2)];
    }

    function createGame(
        uint256 betDuration,
        uint256 submitProofDuration,
        uint256 betAmount,
        uint256 minBetValue,
        uint256 maxBetValue
    ) public nonReentrant {
        currentGameId++;
        game[currentGameId].betDuration = betDuration;
        game[currentGameId].submitProofDuration = submitProofDuration;
        game[currentGameId].betDeadline = block.timestamp + betDuration;
        game[currentGameId].submitProofDeadline =
            block.timestamp +
            betDuration +
            submitProofDuration;
        game[currentGameId].totalBounty = 0;
        game[currentGameId].minBetValue = minBetValue;
        game[currentGameId].maxBetValue = maxBetValue;
        game[currentGameId].bestBet = maxBetValue;
        game[currentGameId].betAmount = betAmount;
        game[currentGameId].winner = address(0);
        game[currentGameId].owner = msg.sender;
    }

    function submitBet(uint256 gameId, uint256 y) public payable nonReentrant {
        require(
            msg.value == game[gameId].betAmount,
            "You must bet the right amount"
        );
        require(
            block.timestamp <= game[gameId].betDeadline,
            "Betting time is over"
        );
        game[currentGameId].totalBounty += msg.value;
        game[currentGameId].bets[y] = msg.sender;
    }

    function submitProof(
        uint256 gameId,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[2] calldata input
    ) public payable nonReentrant {
        require(
            block.timestamp > game[gameId].betDeadline &&
                block.timestamp < game[gameId].submitProofDeadline,
            "Not the right time to submit proof"
        );
        uint256 x = input[0];
        uint256 y = input[1];
        require(
            game[gameId].bets[y] == msg.sender,
            "Bet is not submitted with this address"
        );
        require(
            game[gameId].betSubmitted[x] == address(0),
            "Bet already submitted"
        );
        require(
            x >= game[gameId].minBetValue && x <= game[gameId].maxBetValue,
            "Invalid bet"
        );
        (bool verifyOK, ) = verifier.call(
            abi.encodeCall(IVerifier.verifyProof, (a, b, c, [x, y]))
        );
        require(verifyOK, "Invalid proof");
        game[gameId].betSubmitted[x] = msg.sender;
        if (game[gameId].bestBet > x) {
            game[gameId].bestBet = x;
            game[gameId].winner = msg.sender;
        }
    }

    function claimReward(uint256 gameId) public nonReentrant {
        require(
            block.timestamp >
                game[gameId].submitProofDeadline +
                    game[gameId].submitProofDuration,
            "The game is not over"
        );
        require(game[gameId].claimed == false, "Reward already claimed");
        require(game[gameId].winner == msg.sender, "You are not the winner");
        uint256 bet = game[gameId].bestBet;
        uint256 remainder = bet - game[gameId].minBetValue;
        uint256 reward = (game[gameId].totalBounty * remainder) /
            (game[gameId].maxBetValue - game[gameId].minBetValue + 1);
        game[gameId].claimed = true;
        payable(msg.sender).transfer(reward);
        payable(game[gameId].owner).transfer(game[gameId].totalBounty - reward);
    }

    function withdraw(uint256 gameId) public {
        require(
            block.timestamp >
                game[gameId].submitProofDeadline +
                    game[gameId].submitProofDuration,
            "The game is not over"
        );
        require(game[gameId].claimed == false, "Reward already claimed");
        require(game[gameId].owner == msg.sender, "You are not the owner");
        uint256 bet = game[gameId].bestBet;
        uint256 remainder = bet - game[gameId].minBetValue;
        uint256 reward = (game[gameId].totalBounty * remainder) / 100;

        game[gameId].claimed = true;
        payable(game[gameId].winner).transfer(reward);
        payable(game[gameId].owner).transfer(game[gameId].totalBounty - reward);
    }
}
