# ZK-Bet Game

## Rules

The game is inspired by the Armageddon mode in Chess. Armageddon is a chess game mode in which the player who plays with the white pieces has more time on the clock, but in case of a draw, the player with the black pieces wins the game. The two players will have to bet for the time the will play, the player who bets the higher time will play the white pieces and the player who bets the lower time will play the black pieces. The player who bets the lower time will win the game in case of a draw. The game is played in a zero-knowledge environment, so the players will not know what the other player bet. The game is played in a zero-knowledge environment, so the players will not know what the other player bet.

In ZK-Bet, each player will bet a number in a certain range, the player who bets the lowest number will win but with the less bounty overall and the remaining bounty will belong to the game creator. But the special part is that nobody can know what other player bet, so the game is played in a zero-knowledge environment. When the bet duration is over, players will need to submit the proof that they participated in the game and the number they bet, and the number they bet will be revealed. The player who bet the lowest number will win the game and the bounty.
If any player bets the same number as another player, the bounty will belong to the first player who submit the proof of the bet. After the game ends, the winner can claim the bounty and the rest will be transferred to the game creator.

## Technical Details

### Game Flow

1. The game creator will create a game with a certain bounty, bet range, and a time limit.
2. The players will join the game by betting a number in the bet range and in the bet time limit.
3. The game will end when the time limit is reached.
4. The players will submit the proof of the bet and the number they bet.
5. The game will reveal the numbers and the winner will be determined.
6. The winner can claim the bounty and the rest will be transferred to the game creator.

## Contracts

### Banker.sol

The most important functions are `submitBet` and `submitProof`.

- `submitBet` is used to submit a bet to the game. The input is the game id and the number the player bet. But the number is not revealed yet.
- `submitProof` is used to submit the proof of the bet. The input is the game id, the number the player bet, and the proof. The proof will be verified by the contract and if it is valid, the number will be revealed.

### Verifier.sol

The contract is used to verify the zk proof. The contract will be deployed with the verification key. It was generated using circom and snarkJs.

## ZK Proof

- When player submits a bet, they will also submit a zk proof that they bet a number in the bet range.
- The zk proof will be verified by the contract to ensure that the player bet a number in the bet range.
- The zk proof will be generated using circom and snarkJs. The setup is Groth16.
