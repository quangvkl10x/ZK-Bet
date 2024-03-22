const { time } = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
async function main() {
  await time.latest();
  const currentTime = await time.latest();
  await time.increase(60); // 1 minutes
  const newTime = await time.latest();
  console.log("Time increased from", currentTime, "to", newTime);
}

main();
