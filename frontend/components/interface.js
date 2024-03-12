import { useState } from "react";
import $u from "../utils/$u.js";
import { BigNumber, Contract, ethers } from "ethers";
import "bootstrap/dist/css/bootstrap.min.css";
import getGameId from "../api/getGameId.js";
import getTotalBounty from "../api/getTotalBounty.js";

const wc = require("../circuit/witness_calculator.js");
// sepolia
const bankerAddress = require("../api/helper.js").BankerAddress;
//hardhat
// const bankerAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const bankerABI = require("../json/banker.json").abi;
const bankerInterface = new ethers.utils.Interface(bankerABI);

const Interface = () => {
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [section, setSection] = useState("deposit");
  const [submitProofSuccess, setSubmitProofSuccess] = useState(false);
  const [gameId, setGameId] = useState(0);
  const [betNumber, setBetNumber] = useState(0);
  const [bounty, setBounty] = useState(0);
  const [proofString, setProofString] = useState(null);

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
      if (chainId !== process.env.NEXT_PUBLIC_CHAIN_ID) {
        alert("Please switch to Baobab testnet");
        throw "Wrong network";
      }
      let activeAccount = accounts[0];
      let balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [activeAccount, "latest"],
      });
      balance = $u.moveDecimalLeft(ethers.BigNumber.from(balance), 18);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      setSigner(signer);
      let newAccountState = {
        address: activeAccount,
        balance,
        chainId,
      };
      setGameId(await getGameId());
      setBounty(await getTotalBounty());
      setAccount(newAccountState);
    } catch (err) {
      console.log(err);
    }
  };

  const depositEther = async () => {
    // generate secret, nullifier
    const secret = ethers.BigNumber.from(ethers.utils.randomBytes(32));

    const input = {
      x: betNumber,
      secret: secret,
      gameId: gameId,
    };

    const res = await fetch("/bet.wasm");
    const buffer = await res.arrayBuffer();
    const depositWC = await wc(buffer);
    try {
      const r = await depositWC.calculateWitness(input, 0);
      const y = r[1];
      const value = "100000000000000000";

      try {
        const ca = new Contract(bankerAddress, bankerABI, signer);
        const tx = await ca.submitBet(y, { value });
        console.log(tx);
        // const txHash = await window.ethereum.request({
        //   method: "eth_sendTransaction",
        //   params: [tx],
        // });
        console.log(btoa(JSON.stringify({ ...input, y: y.toString() })));
        setProofString(btoa(JSON.stringify({ ...input, y: y.toString() })));
      } catch (err) {
        console.log(err);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const submitProof = async () => {
    try {
      const proofElements = JSON.parse(atob(proofString));

      const SnarkJs = window["snarkjs"];

      const proofInput = {
        x: $u.BNToDecimal(proofElements.x),
        gameId: $u.BNToDecimal(proofElements.gameId),
        secret: $u.BNToDecimal(proofElements.secret),
        recipient: $u.BNToDecimal(account.address),
        y: $u.BNToDecimal(proofElements.y),
      };
      console.log(proofInput);
      const { proof, publicSignals } = await SnarkJs.groth16.fullProve(
        proofInput,
        "/claim.wasm",
        "/setup_final.zkey"
      );
      console.log(proof, publicSignals);

      const callInputs = [
        proof.pi_a.slice(0, 2).map($u.BN256ToHex),
        proof.pi_b
          .slice(0, 2)
          .map((row) => $u.reverseCoordinates(row.map($u.BN256ToHex))),
        proof.pi_c.slice(0, 2).map($u.BN256ToHex),
        publicSignals.slice(0, 3).map($u.BN256ToHex),
      ];
      console.log(callInputs);

      const callData = bankerInterface.encodeFunctionData(
        "submitProof",
        callInputs
      );
      const tx = {
        to: bankerAddress,
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

      if (!!receipt) setsubmitProofSuccess(true);
    } catch (err) {
      console.log(err);
    }
  };
  const claimBounty = async () => {
    const calldata = bankerInterface.encodeFunctionData("claimReward", []);
    const tx = {
      to: bankerAddress,
      from: account.address,
      data: calldata,
    };
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    const receipt = await window.ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    console.log(receipt);
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
                <h5>ZK-Bet</h5>
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
                  <>
                    <button
                      onClick={() => setSection("deposit")}
                      className="btn btn-outline-primary"
                    >
                      Deposit
                    </button>
                  </>
                )}
                {section === "submitProof" ? (
                  <button className="btn btn-primary">Submit Proof</button>
                ) : (
                  <button
                    onClick={() => setSection("submitProof")}
                    className="btn btn-outline-primary"
                  >
                    Submit Proof
                  </button>
                )}
                {section === "claim" ? (
                  <button className="btn btn-primary">Claim</button>
                ) : (
                  <button
                    onClick={() => setSection("claim")}
                    className="btn btn-outline-primary"
                  >
                    Claim
                  </button>
                )}
              </div>
              {section === "deposit" && !!account && (
                <div>
                  <div>
                    <span>
                      <strong>Game Id: {gameId}</strong>
                    </span>
                    <br />
                    <span>
                      <strong>
                        Bounty: {ethers.utils.formatUnits(bounty, 18)}
                      </strong>
                    </span>
                    <br />
                  </div>
                  <form>
                    <div className="form-group">
                      <label htmlFor="betNumber">Bet Number</label>
                      <input
                        type="number"
                        className="form-control"
                        id="betNumber"
                        placeholder="Enter bet number"
                        onChange={(e) => setBetNumber(e.target.value)}
                      />
                    </div>
                  </form>
                  <button className="btn btn-success" onClick={depositEther}>
                    <span className="small">Submit Bet</span>
                  </button>
                  {proofString}
                </div>
              )}
              {section === "submitProof" && !!account && (
                <div>
                  {submitProofSuccess ? (
                    <div>
                      <div className="alert alert-success">
                        <div>
                          <span>
                            <strong>Success!</strong>
                          </span>
                        </div>
                        <div>
                          <span className="text-secondary">
                            Submit Proof successful. You can check your wallet
                            to verify.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="form-group">
                        <form>
                          <div className="form-group">
                            <label htmlFor="proofString">Proof String</label>
                            <input
                              type="text"
                              className="form-control"
                              id="proofString"
                              placeholder="Enter proof string"
                              onChange={(e) => setProofString(e.target.value)}
                            />
                          </div>
                        </form>
                      </div>
                      <button className="btn btn-primary" onClick={submitProof}>
                        <span className="small">Submit Proof</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {section === "claim" && !!account && (
                <div>
                  <div>
                    <span>
                      <strong>Game Id: {gameId}</strong>
                    </span>
                    <br />
                    <span>
                      <strong>
                        Bounty: {ethers.utils.formatUnits(bounty, 18)}
                      </strong>
                    </span>
                    <br />
                  </div>
                  <button className="btn btn-success" onClick={claimBounty}>
                    <span className="small">Claim Bounty</span>
                  </button>
                </div>
              )}
              {!account && (
                <div>
                  <p>Connect wallet to deposit or submitProof</p>
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
