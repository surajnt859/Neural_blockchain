const express = require("express");
const fs = require("fs");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const { optionalAuth } = require("../middleware/authMiddleware");
const Model = require("../models/Model");
const ModelVersion = require("../models/ModelVersion");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const { REAL_AI_MODELS, streamModelZip, runModelInference } = require("../services/modelBundles");
const { verifyOnChainPurchase } = require("../services/transactionVerification");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { ethers } = require("ethers");
const ModelEncryption = require("../models/ModelEncryption");
const { unwrapModelKey } = require("../services/encryptionService");
const { getMarketplaceContract, getOnChainModel } = require("../services/marketplaceReader");
const router = express.Router();
const MODELS_FILE = path.join(__dirname, "../data/models.json");

// Helper to read fallback models from JSON
const readModelsFallback = () => {
    try {
        if (fs.existsSync(MODELS_FILE)) {
            return JSON.parse(fs.readFileSync(MODELS_FILE, "utf8"));
        }
    } catch (e) {
        console.warn("Could not read models.json fallback:", e.message);
    }
    return REAL_AI_MODELS;
};

async function persistVerifiedWallet(userId, walletAddress) {
    const normalizedWallet = walletAddress.toLowerCase();
    if (mongoose.connection.readyState === 1) {
        const existingUser = await User.findOne({
            id: { $ne: userId },
            walletVerified: true,
            walletAddress: new RegExp(`^${normalizedWallet}$`, "i"),
        }).select("id");
        if (existingUser) throw new Error("This wallet is already linked to another account.");

        const updatedUser = await User.findOneAndUpdate(
            { id: userId },
            { $set: { walletAddress: normalizedWallet, walletVerified: true } },
            { new: true }
        );
        if (!updatedUser) throw new Error("Authenticated user account was not found.");
        return;
    }

    const usersFile = path.join(__dirname, "../data/users.json");
    const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile, "utf8")) : [];
    if (users.some((entry) => entry.id !== userId && entry.walletVerified && entry.walletAddress?.toLowerCase() === normalizedWallet)) {
        throw new Error("This wallet is already linked to another account.");
    }
    const user = users.find((entry) => entry.id === userId);
    if (!user) throw new Error("Authenticated user account was not found.");
    user.walletAddress = normalizedWallet;
    user.walletVerified = true;
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Helper to find a model from Mongo or fallback
async function findModelById(id) {
    if (!id) return null;
    const strId = String(id);
    try {
        const queryConditions = [{ id: strId }, { contractModelId: strId }];
        if (mongoose.Types.ObjectId.isValid(strId)) {
            queryConditions.push({ _id: strId });
        }
        const doc = await Model.findOne({ $or: queryConditions }).lean();
        if (doc) return doc;
    } catch (err) {
        console.warn("Mongo findModelById error:", err.message);
    }

    // Fallback to real AI models catalog or models.json
    const inCatalog = REAL_AI_MODELS.find((m) =>
        String(m.id) === strId ||
        String(m.contractModelId) === strId ||
        (m._id && String(m._id) === strId)
    );
    if (inCatalog) return inCatalog;

    const list = readModelsFallback();
    return list.find((m) =>
        String(m.id) === strId ||
        String(m.contractModelId) === strId ||
        (m._id && String(m._id) === strId)
    ) || null;
}

async function joinOnChainListing(model) {
    if (!model || !/^\d+$/.test(String(model.contractModelId || ""))) {
        throw new Error("Model does not have a resolvable on-chain listing ID.");
    }
    const listing = await getOnChainModel(model.contractModelId);
    if (listing.ownerWallet.toLowerCase() !== String(model.ownerWallet || "").toLowerCase() ||
        listing.ipfsHash !== model.ipfsHash ||
        listing.modelHash.toLowerCase() !== `0x${String(model.modelHash || "").replace(/^0x/, "")}`.toLowerCase()) {
        throw new Error("Stored model metadata does not match the authoritative on-chain listing.");
    }
    return {
        ...model,
        ownerWallet: listing.ownerWallet.toLowerCase(),
        ipfsHash: listing.ipfsHash,
        modelHash: listing.modelHash.replace(/^0x/, ""),
        keyHash: listing.keyHash.replace(/^0x/, ""),
        price: Number(ethers.formatEther(listing.priceWei)),
        onChainActive: listing.isActive,
        onChainParentModelId: listing.parentModelId,
    };
}

function isMissingOnChainListing(error) {
    return error.code === "CALL_EXCEPTION" &&
        (error.reason === "Model does not exist" ||
            error.shortMessage === 'execution reverted: "Model does not exist"');
}

// GET /api/models — list all models with filters & search
router.get("/", async(req, res) => {
    try {
        const { category, search, sort, limit } = req.query;
        let models = [];

        try {
            let query = { archived: { $ne: true } };
            query.verificationStatus = { $in: ["verified", "legacy"] };
            if (category && category !== "All") {
                query.category = category;
            }
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { description: { $regex: search, $options: "i" } },
                    { tags: { $in: [new RegExp(search, "i")] } },
                ];
            }

            let mongoQuery = Model.find(query);
            if (sort === "price-asc") mongoQuery = mongoQuery.sort({ price: 1 });
            else if (sort === "price-desc") mongoQuery = mongoQuery.sort({ price: -1 });
            else if (sort === "popular") mongoQuery = mongoQuery.sort({ downloads: -1 });
            else mongoQuery = mongoQuery.sort({ createdAt: -1 });

            models = await mongoQuery.lean();
        } catch (dbErr) {
            console.warn("MongoDB query failed, using fallback:", dbErr.message);
            models = readModelsFallback();
        }

        // If MongoDB had 0 models, use seeded REAL_AI_MODELS catalog
        if (!models || models.length === 0) {
            models = REAL_AI_MODELS;
        }

        models = models.filter((model) => !model.verificationStatus || ["verified", "legacy"].includes(model.verificationStatus));

        // Apply query filters in-memory if fallback was used
        if (category && category !== "All") {
            models = models.filter((m) => m.category === category);
        }
        if (search) {
            const q = search.toLowerCase();
            models = models.filter(
                (m) =>
                m.name.toLowerCase().includes(q) ||
                m.description.toLowerCase().includes(q) ||
                (Array.isArray(m.tags) && m.tags.some((t) => t.toLowerCase().includes(q)))
            );
        }

        const resolvedModels = await Promise.all(models.map(async(model) => {
            if (!/^\d+$/.test(String(model.contractModelId || ""))) {
                console.warn(`Skipping model ${model.id}: no resolvable on-chain listing ID.`);
                return null;
            }
            try {
                return await joinOnChainListing(model);
            } catch (error) {
                if (isMissingOnChainListing(error) ||
                    error.message === "Stored model metadata does not match the authoritative on-chain listing.") {
                    console.warn(`Skipping model ${model.id}: ${error.message}`);
                    return null;
                }
                throw error;
            }
        }));
        const enrichedModels = resolvedModels.filter(Boolean);
        const paginatedModels = limit ?
            enrichedModels.slice(0, parseInt(limit, 10)) :
            enrichedModels;
        res.json({ models: paginatedModels, total: paginatedModels.length });
    } catch (err) {
        console.error("Failed to fetch models:", err);
        res.status(500).json({ error: "Failed to fetch models." });
    }
});

// GET /api/models/:id — single model detail
router.get("/:id", optionalAuth, async(req, res) => {
    try {
        const model = await findModelById(req.params.id);
        if (!model) {
            return res.status(404).json({ error: "Model not found." });
        }
        if (model.archived && !(req.user && (req.user.role === "admin" || (model.owner && req.user.id === model.owner.id)))) {
            return res.status(404).json({ error: "Model not found." });
        }
        const isPrivilegedViewer = (req.user && req.user.role === "admin") || (req.user && model.owner && req.user.id === model.owner.id);
        if (model.verificationStatus && !["verified", "legacy"].includes(model.verificationStatus) && !isPrivilegedViewer) {
            return res.status(404).json({ error: "Model is not available in the marketplace." });
        }
        if (!/^\d+$/.test(String(model.contractModelId || ""))) {
            return res.status(404).json({ error: "Model does not have a resolvable on-chain listing." });
        }
        try {
            return res.json(await joinOnChainListing(model));
        } catch (error) {
            if (isMissingOnChainListing(error) ||
                error.message === "Stored model metadata does not match the authoritative on-chain listing.") {
                return res.status(404).json({ error: "Model does not have a matching on-chain listing." });
            }
            throw error;
        }
    } catch (err) {
        console.error("Failed to fetch model:", err);
        res.status(500).json({ error: "Failed to fetch model." });
    }
});

// POST /api/models — create listing (optional auth for Web3 or registered users)
router.post("/", authMiddleware, async(req, res) => {
    try {
        const {
            name,
            description,
            category,
            fileName,
            ipfsHash,
            modelHash,
            price,
            txHash,
            contractModelId,
            tags,
            framework,
            modelFormat,
            benchmarks,
            architecture,
            verificationChecks,
            verificationWarnings,
            encryptedUploadId,
            keyHash,
            architectureHash,
            version,
            parentModelId,
        } = req.body;

        const { walletAddress, walletTimestamp, walletSignature } = req.body;
        if (!name || !ipfsHash || !txHash || !contractModelId || !walletAddress) {
            return res.status(400).json({ error: "Name, IPFS CID, listing transaction, contract model ID, and creator wallet are required." });
        }
        if (!ethers.isAddress(walletAddress) ||
            !/^0x[a-fA-F0-9]{64}$/.test(`0x${String(modelHash || "").replace(/^0x/, "")}`) ||
            !/^0x[a-fA-F0-9]{64}$/.test(`0x${String(keyHash || "").replace(/^0x/, "")}`)) {
            return res.status(400).json({ error: "Creator wallet and SHA-256/key hashes must be valid." });
        }

        const requestTime = Number(walletTimestamp);
        if (!walletSignature || !Number.isFinite(requestTime) || Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: "A current creator-wallet signature is required." });
        }
        const walletProofMessage = `NeuralChain creator wallet:${req.user.id}:${walletAddress.toLowerCase()}:${requestTime}`;
        let recoveredWallet;
        try {
            recoveredWallet = ethers.verifyMessage(walletProofMessage, walletSignature);
        } catch {
            return res.status(401).json({ error: "Creator-wallet signature is invalid." });
        }
        if (recoveredWallet.toLowerCase() !== walletAddress.toLowerCase()) {
            return res.status(401).json({ error: "Creator-wallet signature does not match the listing wallet." });
        }

        const ownerWallet = ethers.getAddress(walletAddress);
        let onChainModel;
        try {
            onChainModel = await getOnChainModel(contractModelId);
        } catch (error) {
            return res.status(400).json({ error: `On-chain listing could not be verified: ${error.message}` });
        }
        if (onChainModel.ownerWallet.toLowerCase() !== ownerWallet.toLowerCase() ||
            onChainModel.ipfsHash !== ipfsHash ||
            onChainModel.modelHash.toLowerCase() !== `0x${String(modelHash).replace(/^0x/, "")}`.toLowerCase() ||
            onChainModel.keyHash.toLowerCase() !== `0x${String(keyHash || "").replace(/^0x/, "")}`.toLowerCase()) {
            return res.status(400).json({ error: "Submitted listing metadata does not match the authoritative on-chain listing." });
        }

        try {
            await persistVerifiedWallet(req.user.id, ownerWallet);
        } catch (error) {
            const statusCode = error.message.includes("already linked") ? 409 : 503;
            return res.status(statusCode).json({ error: error.message });
        }

        const uploadKeyRecord = encryptedUploadId ?
            await ModelEncryption.findOne({ uploadId: encryptedUploadId, uploaderId: req.user.id, cid: ipfsHash }) : null;
        if (encryptedUploadId && (!uploadKeyRecord || uploadKeyRecord.keyHash !== String(keyHash).replace(/^0x/, ""))) {
            return res.status(400).json({ error: "Encrypted upload session is missing or does not match this listing." });
        }
        if (onChainModel.priceWei > 0n && !encryptedUploadId) {
            return res.status(400).json({ error: "Paid model listings must reference an encrypted upload." });
        }

        const verificationStatus = "pending";
        const verificationScore = Number(req.body.verificationScore) || 0;

        const newModelData = {
            id: `model-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            fileName: typeof fileName === "string" ? path.basename(fileName).slice(0, 255) : null,
            description: description || "",
            category: category || "General AI",
            ipfsHash,
            modelHash: String(modelHash).replace(/^0x/, ""),
            keyHash: keyHash ? String(keyHash).replace(/^0x/, "") : null,
            price: Number(ethers.formatEther(onChainModel.priceWei)),
            owner: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
            },
            ownerWallet: ownerWallet.toLowerCase(),
            contractModelId: String(contractModelId),
            blockchainTxHash: txHash,
            verificationStatus,
            verificationScore,
            verificationChecks: verificationChecks || null,
            verificationWarnings: Array.isArray(verificationWarnings) ? verificationWarnings : [],
            framework: framework || "Unknown",
            modelFormat: modelFormat || "Unknown",
            benchmarks: benchmarks || {},
            architecture: architecture || "",
            architectureHash: architectureHash || null,
            version: Number(version) || 1,
            parentModelId: parentModelId || null,
            downloads: 0,
            rating: "5.0",
            tags: Array.isArray(tags) ? tags : [],
            purchases: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (uploadKeyRecord) {
            uploadKeyRecord.modelId = newModelData.id;
            uploadKeyRecord.expiresAt = null;
            await uploadKeyRecord.save();
        }

        // Always sync to JSON fallback store
        try {
            const list = readModelsFallback();
            list.unshift(newModelData);
            fs.writeFileSync(MODELS_FILE, JSON.stringify(list, null, 2));
        } catch (fErr) {
            console.warn("Could not sync to models.json:", fErr.message);
        }

        try {
            const created = await Model.create(newModelData);
            return res.status(201).json({ message: "Model listed successfully!", model: created });
        } catch (dbErr) {
            console.warn("MongoDB create failed, saved in fallback store:", dbErr.message);
            return res.status(201).json({ message: "Model listed successfully!", model: newModelData });
        }
    } catch (err) {
        console.error("Failed to create model listing:", err);
        res.status(500).json({ error: "Failed to create model listing." });
    }
});

router.post("/:id/key", async(req, res) => {
    try {
        const { walletAddress, timestamp, signature } = req.body;
        if (!ethers.isAddress(walletAddress) || !signature || !Number.isFinite(Number(timestamp))) {
            return res.status(400).json({ error: "A wallet address, timestamp, and signature are required." });
        }
        const requestTime = Number(timestamp);
        if (Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
            return res.status(401).json({ error: "Wallet access signature has expired." });
        }
        const message = `NeuralChain encrypted model key:${req.params.id}:${walletAddress.toLowerCase()}:${requestTime}`;
        if (ethers.verifyMessage(message, signature).toLowerCase() !== walletAddress.toLowerCase()) {
            return res.status(401).json({ error: "Wallet access signature is invalid." });
        }

        const model = await findModelById(req.params.id);
        if (!model || !model.contractModelId || !model.keyHash) {
            return res.status(404).json({ error: "Encrypted model listing not found." });
        }
        const contract = getMarketplaceContract();
        const [listing, hasAccess] = await Promise.all([
            getOnChainModel(model.contractModelId),
            contract.checkAccess(model.contractModelId, walletAddress),
        ]);
        if (!hasAccess) {
            return res.status(403).json({ error: "On-chain model access is required before releasing the decryption key." });
        }
        if (listing.ipfsHash !== model.ipfsHash ||
            listing.keyHash.toLowerCase() !== `0x${model.keyHash.replace(/^0x/, "")}`.toLowerCase()) {
            return res.status(409).json({ error: "Stored model metadata does not match the on-chain listing." });
        }

        const keyRecord = await ModelEncryption.findOne({ modelId: model.id })
            .select("+contentIv +contentAuthTag +wrappedKey +wrapIv +wrapAuthTag");
        if (!keyRecord) {
            return res.status(404).json({ error: "Wrapped model key is unavailable." });
        }
        const key = unwrapModelKey(keyRecord);
        const keyHashOnServer = crypto.createHash("sha256").update(key).digest("hex");
        if (keyHashOnServer !== keyRecord.keyHash ||
            `0x${keyHashOnServer}`.toLowerCase() !== listing.keyHash.toLowerCase()) {
            return res.status(500).json({ error: "Stored model key failed its on-chain integrity check." });
        }
        return res.json({
            cid: model.ipfsHash,
            key: key.toString("hex"),
            contentIv: keyRecord.contentIv,
            contentAuthTag: keyRecord.contentAuthTag,
            algorithm: "aes-256-gcm",
        });
    } catch (error) {
        console.error("Encrypted model key release failed:", error.message);
        return res.status(500).json({ error: "Could not verify access or release the model key." });
    }
});

// DELETE /api/models/:id — archive a listing for its owner or an admin
router.delete("/:id", authMiddleware, async(req, res) => {
    try {
        const model = await findModelById(req.params.id);
        if (!model) return res.status(404).json({ error: "Model not found." });

        const isOwner = Boolean(model.owner && model.owner.id === req.user.id);
        const isAdmin = req.user.role === "admin";
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: "Only the model owner or an admin can remove this model." });
        }

        const archive = {
            archived: true,
            archivedAt: new Date(),
            archivedBy: req.user.id,
            updatedAt: new Date(),
        };
        try {
            await Model.updateOne({ id: model.id }, { $set: archive });
        } catch (dbErr) {
            console.warn("MongoDB archive failed, updating JSON fallback:", dbErr.message);
        }

        try {
            const list = readModelsFallback();
            const index = list.findIndex((entry) => entry.id === model.id);
            if (index !== -1) {
                list[index] = {...list[index], ...archive };
                fs.writeFileSync(MODELS_FILE, JSON.stringify(list, null, 2));
            }
        } catch (fileErr) {
            console.warn("Could not archive fallback model:", fileErr.message);
        }

        return res.json({ success: true, message: "Model removed from active listings." });
    } catch (err) {
        console.error("Model archive error:", err.message);
        return res.status(500).json({ error: "Failed to remove model." });
    }
});

const PURCHASES_FILE = path.join(__dirname, "../data/purchases.json");

// Helper to read fallback purchases from JSON
const readPurchasesFallback = () => {
    try {
        if (fs.existsSync(PURCHASES_FILE)) {
            return JSON.parse(fs.readFileSync(PURCHASES_FILE, "utf8"));
        }
    } catch (e) {
        console.warn("Could not read purchases.json fallback:", e.message);
    }
    return [];
};

// Helper to save fallback purchase to JSON
const savePurchaseFallback = (purchaseDoc) => {
    try {
        const list = readPurchasesFallback();
        const existingIdx = list.findIndex((p) => p.id === purchaseDoc.id || (p.transactionHash && p.transactionHash === purchaseDoc.transactionHash));
        if (existingIdx !== -1) {
            list[existingIdx] = {...list[existingIdx], ...purchaseDoc };
        } else {
            list.unshift(purchaseDoc);
        }
        fs.writeFileSync(PURCHASES_FILE, JSON.stringify(list, null, 2));
    } catch (e) {
        console.warn("Could not save purchase fallback:", e.message);
    }
};

// POST /api/models/:id/purchase — Record a verified purchase on-chain and in DB
router.post("/:id/purchase", optionalAuth, async(req, res) => {
    try {
        const { txHash, walletAddress, paymentMethod, tier, parentModelId } = req.body;
        const model = await findModelById(req.params.id);

        if (!model) {
            return res.status(404).json({ error: "Model not found." });
        }

        if (!ethers.isAddress(walletAddress) || !txHash) {
            return res.status(400).json({ error: "A valid buyer wallet and mined transaction hash are required." });
        }
        if (!["ETH", "NEURAL"].includes(paymentMethod)) {
            return res.status(400).json({ error: "Only on-chain ETH and NEURAL purchases are supported." });
        }
        if (!model.contractModelId || !/^\d+$/.test(String(model.contractModelId))) {
            return res.status(409).json({ error: "This model does not have a verified on-chain listing." });
        }

        let chainPurchase;
        try {
            chainPurchase = await verifyOnChainPurchase({
                txHash,
                model,
                buyerWallet: walletAddress,
                paymentMethod,
                tier,
            });
        } catch (verificationError) {
            return res.status(402).json({ error: verificationError.message });
        }

        const buyerWallet = walletAddress.toLowerCase();
        const sellerWallet = model.ownerWallet.toLowerCase();
        const buyerUserId = (req.user && req.user.id) || null;
        const purchaseId = `purch-${crypto.randomUUID()}`;
        const purchaseDoc = {
            id: purchaseId,
            modelId: model.id,
            contractModelId: model.contractModelId || null,
            buyerUserId: buyerUserId,
            buyerWallet: buyerWallet,
            sellerWallet: sellerWallet,
            paymentMethod,
            paymentAmount: chainPurchase.paymentAmount,
            licenseTier: chainPurchase.licenseTier,
            parentModelId: parentModelId || model.parentModelId || null,
            transactionHash: chainPurchase.transactionHash,
            verificationStatus: "verified",
            verificationMode: "chain",
            verificationTime: new Date(),
            nftId: model.contractModelId,
            ipfsCID: model.ipfsHash,
            modelHash: model.modelHash,
            createdAt: new Date(),
        };

        // 1. Save to MongoDB Purchase collection
        try {
            await Purchase.create(purchaseDoc);
        } catch (pErr) {
            console.warn("Could not save purchase in MongoDB:", pErr.message);
        }

        // 2. Save to JSON fallback file
        savePurchaseFallback(purchaseDoc);

        // 3. Increment model downloads & purchases in Model collection
        try {
            await Model.updateOne({ id: model.id }, {
                $inc: { downloads: 1 },
                $addToSet: { purchases: buyerUserId },
            });
        } catch (mErr) {
            console.warn("Could not update model downloads in MongoDB:", mErr.message);
        }

        // 4. Update JSON fallback file as well
        try {
            const list = readModelsFallback();
            const idx = list.findIndex((m) => m.id === model.id);
            if (idx !== -1) {
                list[idx].downloads = (list[idx].downloads || 0) + 1;
                if (!Array.isArray(list[idx].purchases)) list[idx].purchases = [];
                if (!list[idx].purchases.includes(buyerUserId)) {
                    list[idx].purchases.push(buyerUserId);
                }
                fs.writeFileSync(MODELS_FILE, JSON.stringify(list, null, 2));
            }
        } catch (fErr) {
            console.warn("Could not update fallback models.json:", fErr.message);
        }

        return res.json({
            success: true,
            message: "Purchase verified on-chain. Sign a key-release request to decrypt the model.",
            hasAccess: true,
            hasPurchased: true,
            purchaseId,
            downloadUrl: `/api/models/${model.id}/download`,
            nftId: purchaseDoc.nftId,
            transactionHash: purchaseDoc.transactionHash,
        });
    } catch (err) {
        console.error("Purchase error:", err);
        res.status(500).json({ error: "Failed to record purchase: " + err.message });
    }
});

// GET /api/models/:id/access — check access for user & wallet
router.get("/:id/access", optionalAuth, async(req, res) => {
    try {
        const model = await findModelById(req.params.id);
        if (!model) return res.status(404).json({ error: "Model not found." });
        const wallet = req.query.wallet;
        if (!model.contractModelId || !ethers.isAddress(wallet || "")) {
            return res.json({ hasAccess: false, isOwner: false, hasPurchased: false, isFree: false });
        }
        const contract = getMarketplaceContract();
        const [listing, hasAccess] = await Promise.all([
            getOnChainModel(model.contractModelId),
            contract.checkAccess(model.contractModelId, wallet),
        ]);
        const isOwner = listing.ownerWallet.toLowerCase() === wallet.toLowerCase();
        const hasPurchased = Boolean(hasAccess && !isOwner);
        const isFree = BigInt(listing.priceWei) === 0n;

        res.json({
            hasAccess,
            isOwner,
            hasPurchased,
            isFree,
            ipfsHash: listing.ipfsHash,
            modelHash: listing.modelHash,
        });
    } catch (err) {
        console.error("Error checking access:", err);
        res.status(500).json({ error: "Failed to check access." });
    }
});

// Paid content is retrieved by CID in the client after the signed key-release check.
router.get("/:id/download", (req, res) => res.status(410).json({
    error: "Model downloads use the encrypted IPFS CID and signed key-release endpoint.",
}));

// POST /api/models/:id/infer — interactive in-browser sandbox runner
router.post("/:id/infer", optionalAuth, async(req, res) => {
    try {
        const model = await findModelById(req.params.id);
        if (!model) return res.status(404).json({ error: "Model not found." });
        if (model.verificationStatus && !["verified", "legacy"].includes(model.verificationStatus)) {
            return res.status(403).json({ error: "This model has not passed moderation and cannot run inference." });
        }

        const result = runModelInference(model, req.body);
        res.json(result);
    } catch (err) {
        console.error("Inference runner error:", err);
        res.status(500).json({ error: "Failed to execute model inference." });
    }
});

// GET /api/models/:id/versions
router.get("/:id/versions", async(req, res) => {
    try {
        const model = await findModelById(req.params.id);
        if (!model) return res.status(404).json({ error: "Model not found." });

        const savedVersions = await ModelVersion.find({ modelId: model.id })
            .sort({ version: 1 })
            .lean();
        const currentVersion = {
            version: model.version || 1,
            versionNotes: model.versionNotes || null,
            createdAt: model.createdAt || new Date(),
            modelHash: model.modelHash,
            ipfsHash: model.ipfsHash,
            downloads: model.downloads || 0,
            contractModelId: model.contractModelId || null,
            verificationStatus: model.verificationStatus || "unverified",
        };
        const versions = savedVersions.filter((version) =>
            Number(version.version) !== Number(currentVersion.version)
        );
        versions.push(currentVersion);
        versions.sort((left, right) => Number(left.version) - Number(right.version));
        res.json({ versions });
    } catch (err) {
        console.error("Failed to fetch model versions:", err.message);
        res.status(500).json({ error: "Failed to fetch model versions." });
    }
});

// POST /api/models/:id/versions — save owner-submitted version metadata for review
router.post("/:id/versions", authMiddleware, async(req, res) => {
    try {
        const model = await findModelById(req.params.id);
        if (!model) return res.status(404).json({ error: "Model not found." });

        if (req.user.role !== "admin" && model.owner?.id !== req.user.id) {
            return res.status(403).json({ error: "Only the model owner or an admin can add version metadata." });
        }

        const versionNumber = Number(req.body.version);
        if (!Number.isFinite(versionNumber) || versionNumber <= 0) {
            return res.status(400).json({ error: "Version must be a positive number." });
        }
        const versionNotes = typeof req.body.versionNotes === "string" ? req.body.versionNotes.trim() : "";
        if (versionNotes.length > 1000) {
            return res.status(400).json({ error: "Version notes must be 1000 characters or fewer." });
        }
        const ipfsHash = typeof req.body.ipfsHash === "string" ? req.body.ipfsHash.trim() : null;
        const sha256Hash = typeof req.body.sha256Hash === "string" ? req.body.sha256Hash.trim() : null;
        if (sha256Hash && !/^(0x)?[a-fA-F0-9]{64}$/.test(sha256Hash)) {
            return res.status(400).json({ error: "SHA-256 hash must contain exactly 64 hexadecimal characters." });
        }

        const latestSavedVersion = await ModelVersion.findOne({ modelId: model.id })
            .sort({ version: -1 })
            .select("version")
            .lean();
        const latestVersion = Math.max(Number(model.version) || 1, Number(latestSavedVersion?.version) || 0);
        if (versionNumber <= latestVersion) {
            return res.status(409).json({ error: "Version must be greater than the latest saved version." });
        }

        const savedVersion = await ModelVersion.create({
            id: `${model.id}-v${versionNumber}`,
            modelId: model.id,
            version: versionNumber,
            parentModelId: model.contractModelId || null,
            baseModelId: model.baseModelId || model.contractModelId || null,
            versionNotes: versionNotes || null,
            previousHash: model.modelHash || null,
            ipfsHash,
            sha256Hash: sha256Hash ? sha256Hash.replace(/^0x/, "") : null,
            verificationStatus: "pending",
            verificationScore: 0,
            price: model.price,
            contractModelId: null,
            blockchainTxHash: null,
            benchmarks: req.body.benchmarks && typeof req.body.benchmarks === "object" && !Array.isArray(req.body.benchmarks) ?
                req.body.benchmarks : {},
            createdAt: new Date(),
        });
        return res.status(201).json({
            message: "Version metadata saved for review.",
            version: savedVersion,
        });
    } catch (err) {
        console.error("Failed to save model version:", err.message);
        res.status(500).json({ error: "Failed to save model version." });
    }
});

module.exports = router;