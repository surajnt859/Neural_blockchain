const mongoose = require("mongoose");

const bountySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true }, // LLM, Vision, Audio, Multimodal, Code
    sponsor: {
      userId: { type: String, required: true },
      username: { type: String, required: true },
      walletAddress: { type: String, required: true },
    },
    rewardAmount: { type: Number, required: true },
    rewardToken: { type: String, enum: ["ETH", "NEURAL", "USDC"], default: "ETH" },
    benchmarkMetric: { type: String, required: true }, // e.g. "WER < 5%", "MMLU > 75%", "Latency < 20ms"
    targetAccuracy: { type: Number, default: 85 },
    frameworkRequirements: { type: String, default: "ONNX / SafeTensors" },
    maxModelSizeMB: { type: Number, default: 250 },
    deadline: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "evaluating", "awarded", "expired"],
      default: "open",
    },
    submissions: [
      {
        submissionId: { type: String, required: true },
        submitterUserId: { type: String, required: true },
        submitterUsername: { type: String, required: true },
        submitterWallet: { type: String, required: true },
        modelId: { type: String, required: true },
        modelName: { type: String, required: true },
        benchmarkScore: { type: Number, required: true },
        verifiedPass: { type: Boolean, default: false },
        submittedAt: { type: Date, default: Date.now },
      },
    ],
    winnerSubmissionId: { type: String, default: null },
    winnerWallet: { type: String, default: null },
    payoutTxHash: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bounty", bountySchema);
