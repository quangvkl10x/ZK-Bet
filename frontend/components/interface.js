import { useEffect, useState } from "react";
import $u from "../utils/$u.js";
import { ethers } from "ethers";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  useConnect,
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useSwitchChain,
} from "wagmi";

const wc = require("../circuit/witness_calculator.js");
// sepolia
const bankerAddress = process.env.NEXT_PUBLIC_BANKER_ADDRESS;
//hardhat
// const bankerAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const bankerABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_verifier",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "claimReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "createGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "currentGameId",
    outputs: [
      {
        internalType: "uint128",
        name: "",
        type: "uint128",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getBounty",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "y",
        type: "uint256",
      },
    ],
    name: "submitBet",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[2]",
        name: "a",
        type: "uint256[2]",
      },
      {
        internalType: "uint256[2][2]",
        name: "b",
        type: "uint256[2][2]",
      },
      {
        internalType: "uint256[2]",
        name: "c",
        type: "uint256[2]",
      },
      {
        internalType: "uint256[3]",
        name: "input",
        type: "uint256[3]",
      },
    ],
    name: "submitProof",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

const Interface = () => {
  const [submitted, setSubmitted] = useState(true);
  const submitGameId = () => {
    // setSubmitted(true);
  };
  const { switchChain } = useSwitchChain();
  const { connectors, connect } = useConnect();
  const { address, chainId } = useAccount();
  const balanceData = useBalance({
    address: address,
  });
  const [account, setAccount] = useState(null);
  const [gameId, setGameId] = useState(0);
  const [bounty, setBounty] = useState(0);
  const gameIdData = useReadContract({
    abi: bankerABI,
    address: bankerAddress,
    functionName: "currentGameId",
  });
  const bountyData = useReadContract({
    abi: bankerABI,
    address: bankerAddress,
    functionName: "getBounty",
  });
  useEffect(() => {
    if (chainId !== parseInt(process.env.NEXT_PUBLIC_CHAIN_ID)) {
      switchChain({ chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID) });
    }
    if (!!balanceData?.data) {
      const newAccount = {
        address: address,
        balance: $u.moveDecimalLeft(balanceData.data.value, 18).slice(0, 6),
        chainId: chainId,
        symbol: balanceData.data.symbol,
      };
      if (newAccount.balance !== account?.balance) {
        setAccount(newAccount);
      }
      if (newAccount.address !== account?.address) {
        setAccount(newAccount);
      }
      if (newAccount.chainId !== account?.chainId) {
        setAccount(newAccount);
      }
    }
    if (!!gameIdData?.data) {
      if (gameIdData.data.toString() !== gameId)
        setGameId(gameIdData.data.toString());
    }
    if (!!bountyData?.data) {
      if (bountyData.data.toString() !== bounty)
        setBounty(bountyData.data.toString());
    }
  }, [balanceData, address, chainId]);

  const [section, setSection] = useState("deposit");
  const [submitProofSuccess, setSubmitProofSuccess] = useState(false);

  const [betNumber, setBetNumber] = useState(0);
  const [proofString, setProofString] = useState(null);
  const [createGameSuccess, setCreateGameSuccess] = useState(false);
  const [claimBountySuccess, setClaimBountySuccess] = useState(false);

  const { writeContractAsync } = useWriteContract();

  const connectMetamask = async () => {
    try {
      connect({ connector: connectors[0] });
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
        // const ca = new Contract(bankerAddress, bankerABI, signer);
        // const tx = await ca.submitBet(y, { value });
        writeContractAsync({
          abi: bankerABI,
          address: bankerAddress,
          functionName: "submitBet",
          args: [y],
          value,
        });
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
      const { proof, publicSignals } = await SnarkJs.groth16.fullProve(
        proofInput,
        "/claim.wasm",
        "/setup_final.zkey"
      );

      const callInputs = [
        proof.pi_a.slice(0, 2).map($u.BN256ToHex),
        proof.pi_b
          .slice(0, 2)
          .map((row) => $u.reverseCoordinates(row.map($u.BN256ToHex))),
        proof.pi_c.slice(0, 2).map($u.BN256ToHex),
        publicSignals.slice(0, 3).map($u.BN256ToHex),
      ];

      await writeContractAsync({
        abi: bankerABI,
        address: bankerAddress,
        functionName: "submitProof",
        args: callInputs,
      });
      setSubmitProofSuccess(true);
    } catch (err) {
      console.log(err);
    }
  };
  const claimBounty = async () => {
    try {
      const res = await writeContractAsync({
        abi: bankerABI,
        address: bankerAddress,
        functionName: "claimBounty",
        args: [],
      });
      setClaimBountySuccess(true);
    } catch (err) {
      console.log(err);
    }
  };

  const createGame = async () => {
    try {
      const res = await writeContractAsync({
        abi: bankerABI,
        address: bankerAddress,
        functionName: "createGame",
        args: [],
      });
      setCreateGameSuccess(true);
    } catch (err) {
      console.log(err);
    }
  };

  return !submitted ? (
    <div>
      <h1>Choose your game id: </h1>
      <form>
        <div className="form-group">
          <label htmlFor="betNumber">Game Id</label>
          <input
            type="number"
            className="form-control"
            id="betNumber"
            placeholder="Enter Game Id"
            onChange={(e) => setGameId(e.target.value)}
          />
        </div>
      </form>
      <button className="btn btn-success" onClick={submitGameId}>
        <span className="small">Submit</span>
      </button>
    </div>
  ) : (
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
                    (account.balance.length > 10 ? "... " : " ") +
                    account.symbol}
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
                {section === "createGame" ? (
                  <button className="btn btn-primary">Create Game</button>
                ) : (
                  <button
                    onClick={() => setSection("createGame")}
                    className="btn btn-outline-primary"
                  >
                    Create Game
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
                    <span>
                      <strong>Time Left: 0</strong>
                    </span>
                    <br />{" "}
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
                  <br />
                  <br />
                  <h2>Your Proof:</h2>
                  <br />
                  {proofString}
                </div>
              )}
              {section === "submitProof" && !!account && (
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
                    <span>
                      <strong>Time Left: 0</strong>
                    </span>
                    <br />{" "}
                  </div>
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
                            Submit Proof successful.
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
                    <span>
                      <strong>Time Left: 0</strong>
                    </span>
                    <br />
                  </div>
                  <button className="btn btn-success" onClick={claimBounty}>
                    <span className="small">Claim Bounty</span>
                  </button>
                  {claimBountySuccess && (
                    <span>Successfully claimed bounty!</span>
                  )}
                </div>
              )}

              {section === "createGame" && !!account && (
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
                    <span>
                      <strong>Time Left: 0</strong>
                    </span>
                    <br />
                  </div>
                  <button className="btn btn-success" onClick={createGame}>
                    <span className="small">Create Game</span>
                  </button>
                  <br />
                  {createGameSuccess && (
                    <span>Successfully created a new game!</span>
                  )}
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
