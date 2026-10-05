const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    // Application layer ID - preserve existing ID format
    id: {
        type: String,
        required: true,
        unique: true,
    },
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    walletAddress: {
        type: String,
        default: null,
    },
    role: {
        type: String,
        enum: ["buyer", "seller", "creator", "admin"],
        default: "buyer",
    },
    isSellerVerified: {
        type: Boolean,
        default: false,
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

// Indexes for frequently queried fields
userSchema.index({ username: 1 });
userSchema.index({ walletAddress: 1 });

module.exports = mongoose.model("User", userSchema);