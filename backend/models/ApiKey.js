const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    walletAddress: { type: String, default: null },
    name: { type: String, default: "Default API Key" },
    keyHash: { type: String, required: true, unique: true },
    keyPrefix: { type: String, required: true }, // e.g., nc_live_xxxx
    rateLimitPerMinute: { type: Number, default: 60 },
    monthlyQuota: { type: Number, default: 10000 },
    usedThisMonth: { type: Number, default: 0 },
    allowedModels: [{ type: String }], // 'all' or specific model IDs
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ApiKey", apiKeySchema);
