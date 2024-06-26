// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const dotenv = require("dotenv");
dotenv.config();

async function main() {
  const bankerAddress = process.env.BANKER_ADDRESS;
  console.log(bankerAddress);
  const bankerContract = new hre.ethers.Contract(
    bankerAddress,
    require("../artifacts/contracts/Banker.sol/Banker.json").abi,
    hre.ethers.provider
  );
  const [signer] = await hre.ethers.getSigners();
  const depositAmount = "100000000000000000"; // 0.1 ETH
  const tx = await bankerContract
    .connect(signer)
    .createGame(60, 60, depositAmount, 1, 100);
  await tx.wait();
  console.log("Game created", tx.hash);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
