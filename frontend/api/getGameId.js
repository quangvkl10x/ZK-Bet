import { ethers } from "ethers";
import { abi as BankerABI } from "../json/banker.json";
import { BankerAddress } from "./helper";

const getGameId = async () => {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_RPC_URL
  );
  const banker = new ethers.Contract(BankerAddress, BankerABI, provider);
  const gameId = await banker.callStatic.currentGameId();
  return gameId.toString();
};

export default getGameId;
