const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  // Application layer ID
  id: {
    type: String,
    required: true,
    unique: true,
  },
  modelId: {
    type: String,
    required: true,
  },
  contractModelId: {
    type: String,
    default: null,
  },
  // Buyer information
  buyerUserId: {
    type: String,
    default: null,
  },
  buyerWallet: {
    type: String,
    required: true,
  },
  // Creator information
  sellerWallet: {
    type: String,
    required: true,
  },
  // Payment details
  paymentMethod: {
    type: String,
    enum: ["ETH", "NEURAL", "CREDIT_CARD", "STRIPE_FIAT", "USDC"],
    required: true,
  },
  paymentAmount: {
    type: Number,
    required: true,
  },
  licenseTier: {
    type: Number,
    enum: [1, 2, 3],
    default: 1,
  },
  parentModelId: {
    type: String,
    default: null,
  },
  // Blockchain verification
  transactionHash: {
    type: String,
    unique: true,
    sparse: true,
  },
  verificationStatus: {
    type: String,
    enum: ["pending", "verified", "failed"],
    default: "pending",
  },
  verificationTime: {
    type: Date,
    default: null,
  },
  // NFT/License
  nftId: {
    type: String,
    default: null,
  },
  ipfsCID: {
    type: String,
    default: null,
  },
  modelHash: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for fast lookups
purchaseSchema.index({ buyerWallet: 1 });
purchaseSchema.index({ modelId: 1 });
purchaseSchema.index({ contractModelId: 1 });
purchaseSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model("Purchase", purchaseSchema);
