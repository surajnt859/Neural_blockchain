const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const { optionalAuth } = authMiddleware;
const { verifyModelFile } = require("../services/modelVerification");
const { encryptModelBuffer } = require("../services/encryptionService");
const { createArchitectureHash, scorePotentialDuplicates } = require("../services/duplicateDetection");
const Model = require("../models/Model");
const ModelEncryption = require("../models/ModelEncryption");

const router = express.Router();
const LOCAL_IPFS_DIR = path.join(__dirname, "../data/ipfs");
// 100MB file size limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
});

// Middleware to capture multer errors (e.g. file size exceeded)
const handleUpload = (req, res, next) => {
    upload.single("file")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ success: false, error: "File size exceeds the 100MB limit." });
            }
            return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        next();
    });
};

// Helper to test if Pinata credentials are valid
function getPinataAuthHeaders() {
    const PINATA_JWT = process.env.PINATA_JWT ? process.env.PINATA_JWT.trim() : "";
    const PINATA_API_KEY = process.env.PINATA_API_KEY ? process.env.PINATA_API_KEY.trim() : "";
    const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY ? process.env.PINATA_SECRET_API_KEY.trim() : "";

    const isJwtValid = PINATA_JWT &&
        PINATA_JWT !== "your_pinata_jwt_token_here" &&
        PINATA_JWT !== "<pinata-jwt-for-real-ipfs>" &&
        PINATA_JWT.length > 30;

    if (isJwtValid) {
        return { Authorization: `Bearer ${PINATA_JWT}` };
    }

    const isKeysValid = PINATA_API_KEY && PINATA_SECRET &&
        PINATA_API_KEY.length > 10 &&
        PINATA_SECRET.length > 20 &&
        PINATA_API_KEY !== "your_pinata_api_key";

    if (isKeysValid) {
        return {
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET,
        };
    }

    return null;
}

function getPinataGateway(ipfsHash) {
    const customGateway = process.env.PINATA_GATEWAY ? process.env.PINATA_GATEWAY.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";
    if (customGateway) {
        return `https://${customGateway}/ipfs/${ipfsHash}`;
    }
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
}

// Local durable demo storage for environments without Pinata credentials.
router.get("/local/:cid", (req, res) => {
    const cid = String(req.params.cid || "");
    if (!/^[A-Za-z0-9]+$/.test(cid)) {
        return res.status(400).json({ error: "Invalid IPFS CID." });
    }

    const localFile = path.join(LOCAL_IPFS_DIR, cid);
    if (!fs.existsSync(localFile)) {
        return res.status(404).json({ error: "Local IPFS object not found." });
    }
    return res.sendFile(localFile);
});

// GET /api/ipfs/status — check Pinata Cloud & IPFS connectivity
router.get("/status", async(req, res) => {
    const authHeaders = getPinataAuthHeaders();
    if (!authHeaders) {
        return res.json({
            connected: false,
            provider: "local-deterministic-ipfs",
            message: "Pinata JWT or API keys not configured. Operating in local deterministic IPFS mode.",
            gateway: "https://ipfs.io/ipfs/",
        });
    }

    try {
        const testRes = await axios.get("https://api.pinata.cloud/data/testAuthentication", {
            headers: authHeaders,
            timeout: 5000,
        });
        return res.json({
            connected: true,
            provider: "pinata-cloud",
            message: "Pinata Cloud IPFS gateway connected successfully! 🚀",
            gateway: getPinataGateway(""),
            pinataDetails: testRes.data,
        });
    } catch (err) {
        return res.json({
            connected: false,
            provider: "local-fallback",
            message: `Pinata auth check failed: ${err.response?.data?.error?.details || err.message}`,
            gateway: "https://ipfs.io/ipfs/",
        });
    }
});

// POST /api/ipfs/upload — upload file to IPFS via Pinata or local deterministic multihash
router.post("/upload", authMiddleware, handleUpload, async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No file uploaded." });
        }

        // Step 5: Security & Model File Validation
        const verification = verifyModelFile(req.file);
        if (verification.verificationStatus !== "verified") {
            return res.status(422).json({
                success: false,
                error: `Model verification must pass before IPFS upload: ${verification.warnings.join(" ") || "Static verification did not reach the required score."}`,
                verification,
            });
        }

        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price < 0) {
            return res.status(400).json({ success: false, error: "A valid non-negative model price is required." });
        }
        const tags = typeof req.body.tags === "string" ?
            req.body.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
        const architectureHash = createArchitectureHash({
            architecture: req.body.architecture,
            framework: verification.framework,
            modelFormat: verification.modelFormat,
        });
        const candidate = {
            id: null,
            name: req.body.name,
            description: req.body.description,
            category: req.body.category,
            tags,
            architectureHash,
            modelHash: verification.modelHash,
            parentModelId: req.body.parentModelId || null,
            version: Number(req.body.version) || 1,
        };
        let existingModels;
        if (mongoose.connection.readyState === 1) {
            existingModels = await Model.find({
                archived: { $ne: true },
                verificationStatus: { $in: ["verified", "legacy", "pending", "needs_review"] },
            }).select("id name description category tags architectureHash modelHash parentModelId baseModelId").lean();
        } else {
            const modelsFile = path.join(__dirname, "../data/models.json");
            existingModels = fs.existsSync(modelsFile) ? JSON.parse(fs.readFileSync(modelsFile, "utf8")) : [];
        }
        const duplicateMatches = scorePotentialDuplicates(candidate, existingModels);
        if (duplicateMatches.length > 0) {
            verification.verificationStatus = "needs_review";
            verification.warnings.push("Potential exact or near-duplicate model detected; moderation review is required.");
        }
        verification.duplicateMatches = duplicateMatches;
        verification.architectureHash = architectureHash;

        const isPaid = price > 0;
        let encryption = null;
        let uploadBuffer = req.file.buffer;
        if (isPaid) {
            if (mongoose.connection.readyState !== 1) {
                return res.status(503).json({
                    success: false,
                    error: "Paid model uploads require the configured MongoDB key store.",
                });
            }
            try {
                encryption = encryptModelBuffer(req.file.buffer);
            } catch (error) {
                return res.status(503).json({ success: false, error: error.message });
            }
            uploadBuffer = encryption.encryptedData;
        }

        const authHeaders = getPinataAuthHeaders();
        let ipfsHash = null;
        let provider = "local-deterministic-ipfs";

        // If Pinata is configured, upload directly to Pinata Cloud
        if (authHeaders) {
            try {
                const formData = new FormData();
                formData.append("file", uploadBuffer, {
                    filename: isPaid ? `${crypto.randomUUID()}.enc` : req.file.originalname,
                    contentType: req.file.mimetype || "application/octet-stream",
                });
                const authenticatedUser = req.user;
                formData.append("pinataMetadata", JSON.stringify({
                    name: isPaid ? "encrypted-model" : req.file.originalname,
                    keyvalues: {
                        uploadedBy: authenticatedUser ? authenticatedUser.username : "NeuralChain-User",
                        framework: verification.framework || "Unknown",
                        format: verification.modelFormat || "Unknown",
                        encrypted: String(isPaid),
                    }
                }));
                formData.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));

                const response = await axios.post(
                    "https://api.pinata.cloud/pinning/pinFileToIPFS",
                    formData, {
                        maxBodyLength: Infinity,
                        headers: {...formData.getHeaders(), ...authHeaders },
                        timeout: 30000,
                    }
                );

                if (response.data && response.data.IpfsHash) {
                    ipfsHash = response.data.IpfsHash;
                    provider = "pinata-cloud";
                }
            } catch (pinataErr) {
                if (process.env.NODE_ENV === "production") {
                    return res.status(502).json({
                        success: false,
                        error: "Pinata upload failed. The model was not stored or published.",
                    });
                }
                const pinataResponse = pinataErr && pinataErr.response;
                const pinataDetails = pinataResponse ? pinataResponse.data : pinataErr.message;
                console.warn("Pinata API upload error, falling back to local deterministic IPFS multihash:", pinataDetails);
            }
        }

        if (process.env.NODE_ENV === "production" && !authHeaders) {
            return res.status(503).json({
                success: false,
                error: "Pinata credentials are required for production uploads.",
            });
        }

        if (!ipfsHash) {
            const { ethers } = require("ethers");
            const sha256Hex = crypto.createHash("sha256").update(uploadBuffer).digest("hex");
            const multihashBuffer = Buffer.from("1220" + sha256Hex, "hex");
            ipfsHash = ethers.encodeBase58(multihashBuffer);
            fs.mkdirSync(LOCAL_IPFS_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCAL_IPFS_DIR, ipfsHash), uploadBuffer);
        }

        let encryptedUploadId = null;
        if (encryption) {
            encryptedUploadId = crypto.randomUUID();
            try {
                await ModelEncryption.create({
                    uploadId: encryptedUploadId,
                    uploaderId: req.user.id,
                    cid: ipfsHash,
                    keyHash: encryption.keyHash,
                    contentIv: encryption.contentIv,
                    contentAuthTag: encryption.contentAuthTag,
                    wrappedKey: encryption.wrappedKey,
                    wrapIv: encryption.wrapIv,
                    wrapAuthTag: encryption.wrapAuthTag,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                });
            } catch (error) {
                console.error("Failed to persist wrapped model key:", error.message);
                return res.status(503).json({ success: false, error: "Encrypted model key could not be stored; upload cannot be listed." });
            }
        }

        res.json({
            success: true,
            ipfsHash,
            ipfsUrl: provider === "pinata-cloud" ? getPinataGateway(ipfsHash) : `${req.protocol}://${req.get("host")}/api/ipfs/local/${ipfsHash}`,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            verification,
            provider,
            encrypted: Boolean(encryption),
            keyHash: encryption ? encryption.keyHash : null,
            encryptedUploadId,
            encryptionMetadata: encryption ? {
                contentIv: encryption.contentIv,
                contentAuthTag: encryption.contentAuthTag,
                encryptedHash: encryption.encryptedHash,
            } : null,
        });
    } catch (err) {
        console.error("IPFS Upload Error:", err.message);
        res.status(500).json({
            success: false,
            error: "IPFS upload error.",
            details: err.message,
        });
    }
});

module.exports = router;