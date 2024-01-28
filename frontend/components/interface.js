import { useState } from "react";
import $u from "../utils/$u";
import { ethers } from "ethers";

const wc = require("../circuit/witness_calculator.js");
const tornadoAddress = "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE";
const tornadoABI = require("../json/Tornado.json").abi;
const tornadoInterface = new ethers.utils.Interface(tornadoABI);

const Interface = () => {
  const [account, setAccount] = useState(null);
  const [proofElements, setProofElements] = useState(null);
  const [proofStringEl, setProofStringEl] = useState(null);

  const connectMetamask = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install Metamask");
        throw "Metamask not installed";
      }
      let accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      let chainId = window.ethereum.networkVersion;
      let activeAccount = accounts[0];
      let balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [activeAccount, "latest"],
      });
      balance = $u.moveDecimalLeft(ethers.BigNumber.from(balance), 18);

      let newAccountState = {
        address: activeAccount,
        balance,
        chainId,
      };
      setAccount(newAccountState);
    } catch (err) {
      console.log(err);
    }
  };

  const depositEther = async () => {
    // generate secret, nullifier
    const secret = ethers.BigNumber.from(
      ethers.utils.randomBytes(32)
    ).toString();
    const nullifier = ethers.BigNumber.from(
      ethers.utils.randomBytes(32)
    ).toString();

    const input = {
      secret: $u.BN256ToBin(secret).split(""),
      nullifier: $u.BN256ToBin(nullifier).split(""),
    };

    const res = await fetch("/deposit.wasm");
    const buffer = await res.arrayBuffer();
    const depositWC = await wc(buffer);
    try {
      const r = await depositWC.calculateWitness(input, 0);
      const commitment = r[1];
      const nullifierHash = r[2];
      const value = ethers.utils.parseEther("1").toHexString();
      const tx = {
        to: tornadoAddress,
        from: account.address,
        value,
        data: tornadoInterface.encodeFunctionData("deposit", [commitment]),
      };
      console.log(commitment);
      console.log(tx);

      try {
        const txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [tx],
        });

        const receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });

        const log = receipt.logs[0];
        const decodedData = tornadoInterface.decodeEventLog(
          "Deposit",
          log.data,
          log.topics
        );

        const proofElements = {
          root: $u.BNToDecimal(decodedData.root),
          nullifierHash: `${nullifierHash}`,
          secret,
          commitment: `${commitment}`,
          hashPairings: decodedData.hashPairings.map((x) => $u.BNToDecimal(x)),
          hashDirections: decodedData.pairDirection,
        };
        console.log(proofElements);
        setProofElements(btoa(JSON.stringify(proofElements)));
      } catch (err) {
        console.log(err);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const copyProofString = () => {
    if (!!proofStringEl) navigator.clipboard.writeText(proofStringEl.innerHTML);
  };

  return (
    <>
      <div>
        {!!account ? (
          <div>
            <p>Balance: {account.balance}</p>
            <p>Chain Id: {account.chainId}</p>
            <p>Wallet Address: {account.address}</p>
          </div>
        ) : (
          <div>
            <button onClick={connectMetamask}>Connect Metamask</button>
          </div>
        )}
      </div>
      {!!account ? (
        <div>
          {!!proofElements && (
            <div>
              <p>
                <strong>Proof of deposit: </strong>
              </p>
              <div style={{ maxWidth: "100vw", overflowWrap: "break-word" }}>
                <span
                  ref={(proofStringEl) => {
                    setProofStringEl(proofStringEl);
                  }}
                >
                  {proofElements}
                </span>
              </div>
              {!!proofStringEl && (
                <button onClick={copyProofString}>Copy</button>
              )}
            </div>
          )}
          <button onClick={depositEther}>Deposit 1 Ether</button>
        </div>
      ) : (
        <div>
          <p>Connect wallet to deposit</p>
        </div>
      )}
    </>
  );
};

export default Interface;
