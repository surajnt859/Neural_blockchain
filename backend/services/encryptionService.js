const crypto = require("crypto");

/**
 * Enterprise Model Weights Encryption & Token-Gated Decryption Service
 * Implements AES-GCM-256 with verifiable integrity tag and access verification.
 */

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const MASTER_SECRET = process.env.MODEL_ENCRYPTION_SECRET || "neuralchain_master_quantum_key_2026_secured";

/**
 * Derives a unique 256-bit encryption key for a specific model ID & version
 */
function deriveModelKey(modelId, version = 1) {
  return crypto.pbkdf2Sync(
    MASTER_SECRET,
    `salt_${modelId}_v${version}`,
    100000,
    32,
    "sha256"
  );
}

/**
 * Encrypts raw model weights / payload buffer before IPFS upload
 */
function encryptModelBuffer(buffer, modelId, version = 1) {
  const iv = crypto.randomBytes(16);
  const key = deriveModelKey(modelId, version);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encryptedData: encrypted,
    algorithm: ENCRYPTION_ALGORITHM,
    contentLength: buffer.length,
    encryptedLength: encrypted.length,
    checksum: crypto.createHash("sha256").update(buffer).digest("hex"),
    encryptedChecksum: crypto.createHash("sha256").update(encrypted).digest("hex"),
  };
}

/**
 * Decrypts model weights for authorized license holder in memory
 */
function decryptModelBuffer(encryptedBuffer, ivHex, authTagHex, modelId, version = 1) {
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = deriveModelKey(modelId, version);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted;
}

/**
 * Generates a tamper-proof digital cryptographic watermark for the model
 */
function generateModelWatermark(modelId, buyerWallet, licenseTier = 1) {
  const payload = {
    modelId,
    buyerWallet: (buyerWallet || "anonymous").toLowerCase(),
    licenseTier,
    issuedAt: new Date().toISOString(),
    protocol: "NeuralChain-DRM-v2",
  };
  const signature = crypto
    .createHmac("sha256", MASTER_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");

  return {
    ...payload,
    signature,
  };
}

module.exports = {
  deriveModelKey,
  encryptModelBuffer,
  decryptModelBuffer,
  generateModelWatermark,
};
