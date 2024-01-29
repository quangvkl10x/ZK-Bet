import { useState } from "react";
import $u from "../utils/$u.js";
import { ethers } from "ethers";
import "bootstrap/dist/css/bootstrap.min.css";

const wc = require("../circuit/witness_calculator.js");
//sepolia
const tornadoAddress = "0x59dC72798Aaacc6557b3Cb14Dd60BCD825dc0312";
//hardhat
// const tornadoAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
const tornadoABI = require("../json/Tornado.json").abi;
const tornadoInterface = new ethers.utils.Interface(tornadoABI);

const Interface = () => {
  const [account, setAccount] = useState(null);
  const [proofElements, setProofElements] = useState(null);
  const [proofStringEl, setProofStringEl] = useState(null);
  const [textArea, setTextArea] = useState(null);
  const [section, setSection] = useState("deposit");
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);

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
      if (chainId !== "11155111") {
        alert("Please switch to Sepolia testnet");
        throw "Wrong network";
      }
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
      const value = ethers.utils.parseEther("0.1").toHexString();
      const tx = {
        to: tornadoAddress,
        from: account.address,
        value,
        data: tornadoInterface.encodeFunctionData("deposit", [commitment]),
      };

      try {
        const txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [tx],
        });
        const proofElements = {
          nullifierHash: `${nullifierHash}`,
          secret,
          nullifier,
          commitment: `${commitment}`,
          txHash,
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

  const withdraw = async () => {
    if (!textArea || !textArea.value) {
      alert("Please paste proof string");
      return;
    }
    try {
      const proofString = textArea.value;
      const proofElements = JSON.parse(atob(proofString));
      const SnarkJs = window["snarkjs"];

      const depositReceipt = await window.ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [proofElements.txHash],
      });
      if (!depositReceipt) {
        throw "empty-reciept";
      }
      const log = depositReceipt.logs[0];
      const decodedData = tornadoInterface.decodeEventLog(
        "Deposit",
        log.data,
        log.topics
      );

      console.log(proofElements);

      const proofInput = {
        root: $u.BNToDecimal(decodedData.root),
        nullifierHash: proofElements.nullifierHash,
        recipient: $u.BNToDecimal(account.address),
        secret: $u.BN256ToBin(proofElements.secret).split(""),
        nullifier: $u.BN256ToBin(proofElements.nullifier).split(""),
        hashPairings: decodedData.hashPairings.map((n) => $u.BNToDecimal(n)),
        hashDirections: decodedData.pairDirection,
      };
      console.log(decodedData);
      console.log(proofInput);
      const { proof, publicSignals } = await SnarkJs.groth16.fullProve(
        proofInput,
        "/withdraw.wasm",
        "/setup_final.zkey"
      );
      console.log(proof);
      console.log(publicSignals);

      const callInputs = [
        proof.pi_a.slice(0, 2).map($u.BN256ToHex),
        proof.pi_b
          .slice(0, 2)
          .map((row) => $u.reverseCoordinates(row.map($u.BN256ToHex))),
        proof.pi_c.slice(0, 2).map($u.BN256ToHex),
        publicSignals.slice(0, 2).map($u.BN256ToHex),
      ];

      const callData = tornadoInterface.encodeFunctionData(
        "withdraw",
        callInputs
      );
      const tx = {
        to: tornadoAddress,
        from: account.address,
        data: callData,
      };
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [tx],
      });
      const receipt = await window.ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });

      if (!!receipt) setWithdrawalSuccess(true);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <>
      <div>
        <nav className="navbar navbar-nav fixed-top bg-dark text-light">
          {!!account ? (
            <div className="container">
              <div className="navbar-left">
                <span>
                  <strong>Chain Id:</strong>
                </span>
                <br />
                <span>{account.chainId}</span>
              </div>
              <div className="navbar-right">
                <span>
                  <strong>{account.address}</strong>
                </span>
                <br />
                <span>
                  Balance:{" "}
                  {account.balance.slice(0, 10) +
                    (account.balance.length > 10 ? "..." : "")}
                </span>
              </div>
            </div>
          ) : (
            <div className="container">
              <div className="navbar-left">
                <h5>Torn</h5>
              </div>
              <div className="navbar-right">
                <button className="btn btn-primary" onClick={connectMetamask}>
                  Connect Metamask
                </button>
              </div>
            </div>
          )}
        </nav>
        <div style={{ height: "60px" }}></div>

        <div className="container" style={{ marginTop: 60 }}>
          <div className="card mx-auto" style={{ maxWidth: 450 }}>
            <div className="card-body">
              <div className="btn-group" style={{ marginBottom: 20 }}>
                {section === "deposit" ? (
                  <button className="btn btn-primary">Deposit</button>
                ) : (
                  <button
                    onClick={() => setSection("deposit")}
                    className="btn btn-outline-primary"
                  >
                    Deposit
                  </button>
                )}
                {section === "withdraw" ? (
                  <button className="btn btn-primary">Withdraw</button>
                ) : (
                  <button
                    onClick={() => setSection("withdraw")}
                    className="btn btn-outline-primary"
                  >
                    Withdraw
                  </button>
                )}
              </div>
              {section === "deposit" && !!account && (
                <div>
                  {!!proofElements ? (
                    <div>
                      <div className="alert alert-success">
                        <span>
                          <strong>Proof of deposit: </strong>
                        </span>
                        <div className="p-1" style={{ lineHeight: "12px" }}>
                          <span
                            style={{ fontSize: "10px" }}
                            ref={(proofStringEl) => {
                              setProofStringEl(proofStringEl);
                            }}
                          >
                            {proofElements}
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn btn-success"
                        onClick={copyProofString}
                      >
                        <span>Copy</span>
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-success" onClick={depositEther}>
                      <span className="small">Deposit 0.1 Eth</span>
                    </button>
                  )}
                </div>
              )}
              {section === "withdraw" && !!account && (
                <div>
                  {withdrawalSuccess ? (
                    <div>
                      <div className="alert alert-success">
                        <div>
                          <span>
                            <strong>Success!</strong>
                          </span>
                        </div>
                        <div>
                          <span className="text-secondary">
                            Withdraw successful. You can check your wallet to
                            verify.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="form-group">
                        <textarea
                          ref={(ta) => {
                            setTextArea(ta);
                          }}
                          className="form-control"
                          style={{ resize: "none" }}
                        ></textarea>
                      </div>
                      <button className="btn btn-primary" onClick={withdraw}>
                        <span className="small">Withdraw</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!account && (
                <div>
                  <p>Connect wallet to deposit or withdraw</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <hr />
    </>
  );
};

export default Interface;
