const mongoose = require("mongoose");

const modelEncryptionSchema = new mongoose.Schema({
    uploadId: { type: String, required: true, unique: true },
    uploaderId: { type: String, required: true },
    modelId: { type: String, default: null, index: true },
    cid: { type: String, required: true },
    keyHash: { type: String, required: true },
    contentIv: { type: String, required: true, select: false },
    contentAuthTag: { type: String, required: true, select: false },
    wrappedKey: { type: String, required: true, select: false },
    wrapIv: { type: String, required: true, select: false },
    wrapAuthTag: { type: String, required: true, select: false },
    expiresAt: { type: Date, default: null },
}, { timestamps: true });

modelEncryptionSchema.index({ modelId: 1, uploaderId: 1 });
modelEncryptionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ModelEncryption", modelEncryptionSchema);
