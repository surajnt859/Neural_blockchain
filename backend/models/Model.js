const mongoose = require("mongoose");

const modelSchema = new mongoose.Schema({
    // Application layer ID - preserve existing model ID format
    id: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    owner: {
        id: String,
        username: String,
        email: String,
    },
    ownerWallet: {
        type: String,
        default: null,
    },
    price: {
        type: Number,
        required: true,
    },
    ipfsHash: {
        type: String,
        default: null,
    },
    modelHash: {
        type: String,
        default: null,
    },
    verificationStatus: {
        type: String,
        enum: ["pending", "verified", "failed", "legacy", "needs_review", "rejected", "unverified"],
        default: "unverified",
    },
    verificationScore: {
        type: Number,
        default: 0,
    },
    framework: {
        type: String,
        default: "Unknown",
    },
    modelFormat: {
        type: String,
        default: "Unknown",
    },
    verificationChecks: {
        type: Object,
        default: null,
    },
    verificationWarnings: {
        type: [String],
        default: [],
    },
    moderationNote: {
        type: String,
        default: "",
    },
    moderatedBy: {
        type: String,
        default: null,
    },
    moderatedAt: {
        type: Date,
        default: null,
    },
    archived: {
        type: Boolean,
        default: false,
    },
    archivedAt: {
        type: Date,
        default: null,
    },
    archivedBy: {
        type: String,
        default: null,
    },
    // Blockchain data
    contractModelId: {
        type: String,
        default: null,
    },
    blockchainTxHash: {
        type: String,
        default: null,
    },
    // Version tracking
    version: {
        type: Number,
        default: 1,
    },
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
    // Metrics - preserve original values without coercing legacy strings into fake numeric measurements
    benchmarks: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    downloads: {
        type: Number,
        default: 0,
    },
    rating: {
        type: String,
        default: "0",
    },
    tags: {
        type: [String],
        default: [],
    },
    // Additional info
    architecture: String,
    license: String,
    inputTypes: [String],
    outputTypes: [String],
    contextWindow: Number,
    pricePerCall: Number,
    // Purchases array - will be migrated to separate collection
    purchases: {
        type: [Object],
        default: [],
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

// Indexes
modelSchema.index({ category: 1 });
modelSchema.index({ owner: 1 });
modelSchema.index({ contractModelId: 1 });
modelSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Model", modelSchema);