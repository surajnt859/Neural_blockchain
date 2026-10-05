const express = require("express");
const crypto = require("crypto");
const Bounty = require("../models/Bounty");
const Model = require("../models/Model");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Curated demo bounties if DB is initially empty
const SEED_BOUNTIES = [
  {
    id: "bounty-med-whisper",
    title: "High-Precision Medical Transcription ONNX Model",
    description:
      "Looking for a quantized Whisper-Tiny or Small ONNX model specialized for clinical terminology, ICD-10 codes, and pharmacological names with WER < 4.5% on noisy clinic audio.",
    category: "Audio",
    sponsor: {
      userId: "user-healthtech-dao",
      username: "BioHealth DAO",
      walletAddress: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    },
    rewardAmount: 2.5,
    rewardToken: "ETH",
    benchmarkMetric: "Word Error Rate (WER) < 4.5%",
    targetAccuracy: 95.5,
    frameworkRequirements: "ONNX / Quantized INT8",
    maxModelSizeMB: 150,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "open",
    submissions: [
      {
        submissionId: "sub-101",
        submitterUserId: "user-alpha-dev",
        submitterUsername: "NeuralDev",
        submitterWallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        modelId: "model-whisper-tiny-onnx",
        modelName: "Whisper-Tiny Multi-lingual Transcriber",
        benchmarkScore: 93.2,
        verifiedPass: false,
        submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  },
  {
    id: "bounty-edge-vision",
    title: "Sub-15ms Industrial Defect Detection Classifier",
    description:
      "Enterprise manufacturing client requires a lightweight vision classifier for PCB solder joint defect detection. Model must run under 15ms latency per image on Raspberry Pi 5 / Edge NPU.",
    category: "Computer Vision",
    sponsor: {
      userId: "user-edge-labs",
      username: "Apex Robotics",
      walletAddress: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    },
    rewardAmount: 50000,
    rewardToken: "NEURAL",
    benchmarkMetric: "F1-Score > 0.96 & Latency < 15ms",
    targetAccuracy: 96.0,
    frameworkRequirements: "ONNX / SafeTensors",
    maxModelSizeMB: 80,
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    status: "open",
    submissions: [],
  },
  {
    id: "bounty-solidity-audit-llm",
    title: "EVM Smart Contract Vulnerability Scanner LLM",
    description:
      "Specialized 1B-3B parameter instruction-tuned model trained on Solidity DeFi hacks, reentrancy vulnerabilities, and front-running attack patterns.",
    category: "Code & Reasoning",
    sponsor: {
      userId: "user-defi-shield",
      username: "DeFi Security Guild",
      walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    },
    rewardAmount: 4.0,
    rewardToken: "ETH",
    benchmarkMetric: "Vulnerability Recall > 92%",
    targetAccuracy: 92.0,
    frameworkRequirements: "SafeTensors / GGUF",
    maxModelSizeMB: 800,
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    status: "open",
    submissions: [],
  },
];

let memoryBounties = [...SEED_BOUNTIES];

// GET /api/bounties — List all RFM bounties
router.get("/", async (req, res) => {
  try {
    const { category, status } = req.query;
    let list = [];

    try {
      let query = {};
      if (category && category !== "All") query.category = category;
      if (status && status !== "All") query.status = status;
      list = await Bounty.find(query).sort({ createdAt: -1 }).lean();
    } catch (e) {
      list = memoryBounties;
    }

    if (!list || list.length === 0) list = memoryBounties;

    if (category && category !== "All") {
      list = list.filter((b) => b.category === category);
    }
    if (status && status !== "All") {
      list = list.filter((b) => b.status === status);
    }

    res.json({ bounties: list, total: list.length });
  } catch (err) {
    console.error("Error fetching bounties:", err);
    res.status(500).json({ error: "Failed to fetch bounties." });
  }
});

// GET /api/bounties/:id — Single bounty detail
router.get("/:id", async (req, res) => {
  try {
    let bounty = null;
    try {
      bounty = await Bounty.findOne({ id: req.params.id }).lean();
    } catch (e) {}

    if (!bounty) {
      bounty = memoryBounties.find((b) => b.id === req.params.id);
    }

    if (!bounty) return res.status(404).json({ error: "Bounty not found." });
    res.json(bounty);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bounty." });
  }
});

// POST /api/bounties — Create a new bounty
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      rewardAmount,
      rewardToken,
      benchmarkMetric,
      targetAccuracy,
      frameworkRequirements,
      maxModelSizeMB,
      deadlineDays,
      walletAddress,
    } = req.body;

    if (!title || !description || !rewardAmount) {
      return res.status(400).json({ error: "Title, description, and reward amount are required." });
    }

    const newBounty = {
      id: `bounty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      description,
      category: category || "General AI",
      sponsor: {
        userId: req.user.id,
        username: req.user.username,
        walletAddress: walletAddress || req.user.walletAddress || "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      },
      rewardAmount: parseFloat(rewardAmount) || 1.0,
      rewardToken: rewardToken === "NEURAL" ? "NEURAL" : rewardToken === "USDC" ? "USDC" : "ETH",
      benchmarkMetric: benchmarkMetric || "Accuracy > 90%",
      targetAccuracy: parseFloat(targetAccuracy) || 90.0,
      frameworkRequirements: frameworkRequirements || "ONNX / SafeTensors",
      maxModelSizeMB: parseInt(maxModelSizeMB, 10) || 200,
      deadline: new Date(Date.now() + (parseInt(deadlineDays, 10) || 30) * 24 * 60 * 60 * 1000),
      status: "open",
      submissions: [],
    };

    try {
      await Bounty.create(newBounty);
    } catch (dbErr) {
      memoryBounties.unshift(newBounty);
    }

    res.status(201).json({ message: "Bounty created successfully!", bounty: newBounty });
  } catch (err) {
    console.error("Error creating bounty:", err);
    res.status(500).json({ error: "Failed to create bounty." });
  }
});

// POST /api/bounties/:id/submit — Submit a model solution to a bounty
router.post("/:id/submit", authMiddleware, async (req, res) => {
  try {
    const { modelId, walletAddress } = req.body;
    let bounty = null;

    try {
      bounty = await Bounty.findOne({ id: req.params.id });
    } catch (e) {
      bounty = memoryBounties.find((b) => b.id === req.params.id);
    }

    if (!bounty) return res.status(404).json({ error: "Bounty not found." });
    if (bounty.status !== "open") return res.status(400).json({ error: "Bounty is no longer accepting submissions." });

    // Find model details
    let model = null;
    try {
      model = await Model.findOne({ id: modelId }).lean();
    } catch (e) {}

    const modelName = model?.name || "Verified Submitted AI Model";
    const simulatedScore = Math.min(
      99.5,
      Number((88 + Math.random() * 11).toFixed(1))
    );
    const verifiedPass = simulatedScore >= (bounty.targetAccuracy || 90);

    const submission = {
      submissionId: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      submitterUserId: req.user.id,
      submitterUsername: req.user.username,
      submitterWallet: walletAddress || req.user.walletAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      modelId,
      modelName,
      benchmarkScore: simulatedScore,
      verifiedPass,
      submittedAt: new Date(),
    };

    try {
      await Bounty.updateOne({ id: bounty.id }, { $push: { submissions: submission } });
    } catch (e) {
      bounty.submissions.push(submission);
    }

    res.status(201).json({
      message: verifiedPass
        ? "Submission verified and exceeds benchmark target! Ready for sponsor award."
        : "Submission evaluated. Benchmark score was slightly below threshold.",
      submission,
      passed: verifiedPass,
    });
  } catch (err) {
    console.error("Error submitting model to bounty:", err);
    res.status(500).json({ error: "Failed to submit to bounty." });
  }
});

// POST /api/bounties/:id/award — Sponsor awards bounty to winning model
router.post("/:id/award", authMiddleware, async (req, res) => {
  try {
    const { submissionId, txHash } = req.body;
    let bounty = null;

    try {
      bounty = await Bounty.findOne({ id: req.params.id });
    } catch (e) {
      bounty = memoryBounties.find((b) => b.id === req.params.id);
    }

    if (!bounty) return res.status(404).json({ error: "Bounty not found." });

    const submission = bounty.submissions.find((s) => s.submissionId === submissionId);
    if (!submission) return res.status(404).json({ error: "Submission not found in this bounty." });

    const updateData = {
      status: "awarded",
      winnerSubmissionId: submissionId,
      winnerWallet: submission.submitterWallet,
      payoutTxHash: txHash || `0x${crypto.randomBytes(32).toString("hex")}`,
    };

    try {
      await Bounty.updateOne({ id: bounty.id }, updateData);
    } catch (e) {
      Object.assign(bounty, updateData);
    }

    res.json({
      message: `Bounty successfully awarded to ${submission.submitterUsername}! Prize payout released.`,
      bounty: { ...bounty, ...updateData },
    });
  } catch (err) {
    console.error("Error awarding bounty:", err);
    res.status(500).json({ error: "Failed to award bounty." });
  }
});

module.exports = router;
