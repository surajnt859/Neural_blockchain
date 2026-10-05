const mongoose = require("mongoose");

const modelVersionSchema = new mongoose.Schema({
  // Application IDs
  id: {
    type: String,
    required: true,
    unique: true,
  },
  modelId: {
    type: String,
    required: true,
  },
  version: {
    type: Number,
    required: true,
  },
  // Parent/base model tracking
  parentModelId: {
    type: String,
    default: null,
  },
  baseModelId: {
    type: String,
    default: null,
  },
  versionNotes: {
    type: String,
    default: null,
  },
  previousHash: {
    type: String,
    default: null,
  },
  // Content hashes
  ipfsHash: {
    type: String,
    default: null,
  },
  sha256Hash: {
    type: String,
    default: null,
  },
  // Verification
  verificationStatus: {
    type: String,
    enum: ["pending", "verified", "failed"],
    default: "pending",
  },
  verificationScore: {
    type: Number,
    default: 0,
  },
  // Price and blockchain
  price: {
    type: Number,
    required: true,
  },
  contractModelId: {
    type: String,
    default: null,
  },
  blockchainTxHash: {
    type: String,
    default: null,
  },
  // Metrics - preserve original values without coercing legacy strings into fake numeric measurements
  benchmarks: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
modelVersionSchema.index({ modelId: 1, version: 1 });
modelVersionSchema.index({ contractModelId: 1 });

module.exports = mongoose.model("ModelVersion", modelVersionSchema);
