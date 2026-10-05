const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
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
  userId: {
    type: String,
    required: true,
  },
  walletAddress: {
    type: String,
    required: true,
  },
  // Review content
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    default: "",
  },
  // Verification
  verifiedPurchase: {
    type: Boolean,
    default: false,
  },
  purchaseId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Composite index to enforce one review per buyer per model
reviewSchema.index({ modelId: 1, userId: 1 }, { unique: true });
// Indexes for fast lookups
reviewSchema.index({ modelId: 1 });
reviewSchema.index({ walletAddress: 1 });

module.exports = mongoose.model("Review", reviewSchema);
