const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema({
  // Application layer ID
  id: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  // Creator information
  creator: {
    type: String,
    required: true,
  },
  creatorWallet: {
    type: String,
    required: true,
  },
  // Voting
  forVotes: {
    type: Number,
    default: 0,
  },
  againstVotes: {
    type: Number,
    default: 0,
  },
  abstainVotes: {
    type: Number,
    default: 0,
  },
  voters: {
    type: [
      {
        wallet: String,
        vote: {
          type: String,
          enum: ["for", "against", "abstain"],
        },
        votePower: Number,
        timestamp: Date,
      },
    ],
    default: [],
  },
  // Timeline
  votingDeadline: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["Active", "Passed", "Failed", "Executed"],
    default: "Active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
proposalSchema.index({ status: 1 });
proposalSchema.index({ votingDeadline: 1 });

module.exports = mongoose.model("Proposal", proposalSchema);
