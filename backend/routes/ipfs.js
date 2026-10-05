const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const { optionalAuth } = authMiddleware;
const { verifyModelFile } = require("../services/modelVerification");

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

        const authHeaders = getPinataAuthHeaders();

        // If Pinata is configured, upload directly to Pinata Cloud
        if (authHeaders) {
            try {
                const formData = new FormData();
                formData.append("file", req.file.buffer, {
                    filename: req.file.originalname,
                    contentType: req.file.mimetype || "application/octet-stream",
                });
                const authenticatedUser = req.user;
                formData.append("pinataMetadata", JSON.stringify({
                    name: req.file.originalname,
                    keyvalues: {
                        uploadedBy: authenticatedUser ? authenticatedUser.username : "NeuralChain-User",
                        framework: verification.framework || "Unknown",
                        format: verification.modelFormat || "Unknown",
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
                    const ipfsHash = response.data.IpfsHash;
                    return res.json({
                        success: true,
                        ipfsHash,
                        ipfsUrl: getPinataGateway(ipfsHash),
                        fileName: req.file.originalname,
                        fileSize: req.file.size,
                        verification,
                        provider: "pinata-cloud",
                    });
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

        // Deterministic IPFS v0 Multihash (SHA-256 base58 CID standard Qm...)
        const { ethers } = require("ethers");
        const crypto = require("crypto");
        const sha256Hex = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
        const multihashBuffer = Buffer.from("1220" + sha256Hex, "hex"); // 0x12 = sha256, 0x20 = 32 bytes length
        const deterministicCid = ethers.encodeBase58(multihashBuffer);
        fs.mkdirSync(LOCAL_IPFS_DIR, { recursive: true });
        fs.writeFileSync(path.join(LOCAL_IPFS_DIR, deterministicCid), req.file.buffer);

        res.json({
            success: true,
            ipfsHash: deterministicCid,
            ipfsUrl: `${req.protocol}://${req.get("host")}/api/ipfs/local/${deterministicCid}`,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            verification,
            provider: "local-deterministic-ipfs",
            note: "Demo-local content-addressed storage is active. Add a valid PINATA_JWT for durable Pinata/IPFS pinning.",
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