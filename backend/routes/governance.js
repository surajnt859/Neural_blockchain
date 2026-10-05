const express = require("express");
const { ethers } = require("ethers");
const authMiddleware = require("../middleware/authMiddleware");
const tokenArtifact = require("../contracts/NeuralToken.json");

const Proposal = require("../models/Proposal");

const router = express.Router();
const PROPOSAL_THRESHOLD = 100;

function getToken() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || "http://127.0.0.1:8545";
  const address = process.env.NEURAL_TOKEN_ADDRESS || tokenArtifact.address;
  if (!address) throw new Error("NEURAL token address is not configured.");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(address, tokenArtifact.abi, provider);
}

async function getVotingPower(walletAddress) {
  if (!ethers.isAddress(walletAddress)) throw new Error("A valid connected wallet address is required.");
  const balance = await getToken().balanceOf(walletAddress);
  return Number(balance / 10n ** 18n);
}

function verifyWalletSignature(walletAddress, signature, message, timestamp) {
  if (!signature || !message || !timestamp || Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) {
    throw new Error("A recent MetaMask signature is required.");
  }
  if (ethers.verifyMessage(message, signature).toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error("Wallet signature does not match the connected address.");
  }
}

router.get("/proposals", async (req, res) => {
  try {
    const proposals = await Proposal.find().sort({ createdAt: -1 });
    res.json(proposals);
  } catch (err) {
    console.error("Error fetching proposals:", err.message);
    res.status(500).json({ error: "Failed to fetch proposals." });
  }
});

router.post("/proposals", authMiddleware, async (req, res) => {
  const { title, description, walletAddress, signature, timestamp } = req.body;
  if (!title || !description) return res.status(400).json({ error: "Missing fields" });

  try {
    verifyWalletSignature(
      walletAddress,
      signature,
      `NeuralChain governance proposal:${title}:${description}:${timestamp}`,
      timestamp
    );
    const votingPower = await getVotingPower(walletAddress);
    if (votingPower < PROPOSAL_THRESHOLD)
      return res.status(403).json({
        error: `At least ${PROPOSAL_THRESHOLD} NEURAL is required to create a proposal.`,
      });

    const newProposal = new Proposal({
      id: Date.now().toString(),
      title,
      description,
      creator: walletAddress,
      creatorWallet: walletAddress,
      status: "Active",
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      voters: [],
      createdAt: new Date(),
    });

    await newProposal.save();
    res.status(201).json({ ...newProposal.toObject(), votingPower });
  } catch (error) {
    console.error("Error creating proposal:", error.message);
    res.status(400).json({ error: error.message });
  }
});

router.post("/proposals/:id/vote", authMiddleware, async (req, res) => {
  const { voteType, walletAddress, signature, timestamp } = req.body; // for, against, abstain

  try {
    const proposal = await Proposal.findOne({ id: req.params.id });

    if (!proposal) return res.status(404).json({ error: "Proposal not found" });
    if (proposal.status !== "Active") return res.status(400).json({ error: "Voting closed" });

    // Check if already voted
    const alreadyVoted = proposal.voters.find(
      (v) => v.wallet?.toLowerCase() === walletAddress.toLowerCase()
    );
    if (alreadyVoted) return res.status(400).json({ error: "Already voted" });

    if (!["for", "against", "abstain"].includes(voteType))
      return res.status(400).json({ error: "Invalid vote type." });

    let weight;
    try {
      verifyWalletSignature(
        walletAddress,
        signature,
        `NeuralChain governance vote:${req.params.id}:${voteType}:${timestamp}`,
        timestamp
      );
      weight = await getVotingPower(walletAddress);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    if (weight < 1) return res.status(403).json({ error: "You need at least 1 NEURAL to vote." });

    // Record vote
    if (voteType === "for") proposal.forVotes += weight;
    else if (voteType === "against") proposal.againstVotes += weight;
    else proposal.abstainVotes += weight;

    proposal.voters.push({
      wallet: walletAddress,
      vote: voteType,
      votePower: weight,
      timestamp: new Date(),
    });

    await proposal.save();
    res.json({ message: "Vote cast with verified NEURAL voting power!", weight, walletAddress });
  } catch (error) {
    console.error("Error recording vote:", error.message);
    res.status(500).json({ error: "Failed to record vote." });
  }
});

module.exports = router;
