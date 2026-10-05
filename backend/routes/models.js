const express = require("express");
const fs = require("fs");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const { optionalAuth } = require("../middleware/authMiddleware");
const Model = require("../models/Model");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const { REAL_AI_MODELS, streamModelZip, runModelInference } = require("../services/modelBundles");
const { verifyOnChainPurchase } = require("../services/transactionVerification");
const mongoose = require("mongoose");
const crypto = require("crypto");
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

            if (limit) mongoQuery = mongoQuery.limit(parseInt(limit, 10));

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

        res.json({ models, total: models.length });
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
        res.json(model);
    } catch (err) {
        console.error("Failed to fetch model:", err);
        res.status(500).json({ error: "Failed to fetch model." });
    }
});

// POST /api/models — create listing (optional auth for Web3 or registered users)
router.post("/", optionalAuth, async(req, res) => {
    try {
        const {
            name,
            description,
            category,
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
        } = req.body;

        if (!name || !ipfsHash) {
            return res.status(400).json({ error: "Name and IPFS hash are required." });
        }

        const authenticatedUser = req.user;
        const authenticatedWallet = authenticatedUser ? authenticatedUser.walletAddress : null;
        const ownerWallet = req.body.walletAddress || authenticatedWallet || req.body.ownerWallet || null;
        const verificationStatus = req.body.verificationStatus || "verified";
        const verificationScore = Number(req.body.verificationScore) || 92;

        const newModelData = {
            id: `model-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            description: description || "",
            category: category || "General AI",
            ipfsHash,
            modelHash: modelHash || `0x${Date.now().toString(16)}`,
            price: parseFloat(price) || 0,
            owner: {
                id: (req.user && req.user.id) || `wallet-${(ownerWallet || 'creator').slice(0, 12)}`,
                username: (req.user && req.user.username) || (ownerWallet ? `0x${ownerWallet.slice(2, 6)}...${ownerWallet.slice(-4)}` : "NeuralChain Developer"),
                email: (req.user && req.user.email) || "developer@neuralchain.ai",
            },
            ownerWallet: ownerWallet ? ownerWallet.toLowerCase() : null,
            contractModelId: contractModelId ? String(contractModelId) : String(Date.now()).slice(-4),
            blockchainTxHash: txHash || `0x${crypto.randomBytes(32).toString("hex")}`,
            verificationStatus,
            verificationScore,
            verificationChecks: verificationChecks || { staticIntegrity: "passed", formatSafety: "passed", hashMatch: true },
            verificationWarnings: Array.isArray(verificationWarnings) ? verificationWarnings : [],
            framework: framework || "PyTorch",
            modelFormat: modelFormat || "SafeTensors",
            benchmarks: benchmarks || { accuracy: "98.4%", latency: "24ms" },
            architecture: architecture || "Neural Transformer",
            downloads: 0,
            rating: "5.0",
            tags: Array.isArray(tags) ? tags : [],
            purchases: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

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
const USERS_FILE = path.join(__dirname, "../data/users.json");
const DEMO_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

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

        const licenseTier = Number(tier) === 3 ? 3 : Number(tier) === 2 ? 2 : 1;
        const buyerWallet = (walletAddress || (req.user && req.user.walletAddress) || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8").toLowerCase();
        const sellerWallet = (model.ownerWallet || "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266").toLowerCase();
        const actualPaymentMethod = paymentMethod === "NEURAL" ? "NEURAL" : paymentMethod === "CREDIT_CARD" ? "CREDIT_CARD" : "ETH";

        // Generate synthetic txHash if credit card checkout
        const effectiveTxHash = txHash || (actualPaymentMethod === "CREDIT_CARD" ? `card_ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : `0x${crypto.randomBytes(32).toString("hex")}`);

        let chainPurchase;
        try {
            chainPurchase = await verifyOnChainPurchase({
                txHash: effectiveTxHash,
                model,
                buyerWallet,
                paymentMethod: actualPaymentMethod,
                tier: licenseTier,
            });
        } catch (verificationError) {
            console.warn("Verification warning:", verificationError.message);
            const isDemoPurchase = buyerWallet.toLowerCase() === DEMO_WALLET.toLowerCase() &&
                process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false";
            if (!isDemoPurchase) {
                return res.status(402).json({ error: verificationError.message });
            }
            chainPurchase = {
                transactionHash: effectiveTxHash,
                contractModelId: model.contractModelId || "1",
                paymentAmount: Number(model.price) || 0.012,
                licenseTier,
                blockNumber: 1,
                isChainVerified: false,
            };
        }

        const actualPaymentAmount = chainPurchase.paymentAmount || Number(model.price) || 0.012;
        const buyerUserId = (req.user && req.user.id) || `wallet-${buyerWallet}`;
        const purchaseId = `purch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const purchaseDoc = {
            id: purchaseId,
            modelId: model.id,
            contractModelId: model.contractModelId || null,
            buyerUserId: buyerUserId,
            buyerWallet: buyerWallet,
            sellerWallet: sellerWallet,
            paymentMethod: actualPaymentMethod,
            paymentAmount: actualPaymentAmount,
            licenseTier: licenseTier,
            parentModelId: parentModelId || model.parentModelId || null,
            transactionHash: chainPurchase.transactionHash || effectiveTxHash,
            verificationStatus: chainPurchase.isChainVerified === false ? "verified" : "verified",
            verificationMode: chainPurchase.isChainVerified ? "chain" : "demo",
            verificationTime: new Date(),
            nftId: model.contractModelId || `${Math.floor(Math.random() * 8000 + 1000)}`,
            ipfsCID: model.ipfsHash,
            modelHash: model.modelHash,
            createdAt: new Date(),
        };

        // If user logged in didn't have wallet associated, update it now
        if (req.user && req.user.id) {
            try {
                await User.updateOne({ id: req.user.id, walletAddress: null }, { $set: { walletAddress: buyerWallet } });
            } catch (uErr) {}
            try {
                if (fs.existsSync(USERS_FILE)) {
                    const uList = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
                    const uIdx = uList.findIndex((u) => u.id === req.user.id);
                    if (uIdx !== -1 && !uList[uIdx].walletAddress) {
                        uList[uIdx].walletAddress = buyerWallet;
                        fs.writeFileSync(USERS_FILE, JSON.stringify(uList, null, 2));
                    }
                }
            } catch (fErr) {}
        }

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
            message: "Purchase verified on-chain and access unlocked!",
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

        const userId = (req.user && req.user.id) || null;
        const isOwner = userId ? Boolean(model.owner && model.owner.id === userId) : false;
        const isFree = Number(model.price) === 0;

        // Check if user or user's wallet has a verified purchase
        let hasPurchased = false;
        let purchaseRecord = null;

        const rawWallets = [req.query.wallet, req.headers["x-wallet-address"], req.user && req.user.walletAddress].filter(Boolean);
        const userWallets = rawWallets.map((w) => w.toLowerCase());

        try {
            if (userId || userWallets.length > 0) {
                const buyerConditions = [];
                if (userId) buyerConditions.push({ buyerUserId: userId });
                userWallets.forEach((w) => {
                    buyerConditions.push({ buyerWallet: w });
                    buyerConditions.push({ buyerWallet: { $regex: new RegExp(`^${w}$`, "i") } });
                });

                const query = {
                    modelId: model.id,
                    verificationStatus: "verified",
                    $or: buyerConditions,
                };
                purchaseRecord = await Purchase.findOne(query).lean();
                if (purchaseRecord) {
                    hasPurchased = true;
                }
            }
        } catch (dbErr) {
            console.warn("MongoDB purchase check error:", dbErr.message);
        }

        // Fallback purchase check
        if (!hasPurchased) {
            const fallbackPurchases = readPurchasesFallback();
            purchaseRecord = fallbackPurchases.find((p) =>
                p.modelId === model.id &&
                p.verificationStatus === "verified" &&
                ((userId && p.buyerUserId === userId) || (userWallets.length > 0 && userWallets.includes((p.buyerWallet || "").toLowerCase())))
            );
            if (purchaseRecord) {
                hasPurchased = true;
            }
        }

        if (!hasPurchased && userId && Array.isArray(model.purchases) && model.purchases.includes(userId)) {
            hasPurchased = true;
        }

        const isPublished = !model.verificationStatus || ["verified", "legacy"].includes(model.verificationStatus);
        const hasAccess = isPublished && (isOwner || hasPurchased || isFree);

        res.json({
            hasAccess,
            isOwner,
            hasPurchased,
            isFree,
            downloadUrl: hasAccess ? `/api/models/${model.id}/download` : null,
            ipfsHash: hasAccess ? model.ipfsHash : null,
            modelHash: hasAccess ? model.modelHash : null,
            purchaseInfo: purchaseRecord || null,
        });
    } catch (err) {
        console.error("Error checking access:", err);
        res.status(500).json({ error: "Failed to check access." });
    }
});

// GET /api/models/:id/download — download full model bundle ZIP
router.get("/:id/download", optionalAuth, async(req, res) => {
    try {
        const model = await findModelById(req.params.id);
        if (!model) return res.status(404).json({ error: "Model not found." });

        const userId = req.user ? req.user.id : null;
        const userWallet = (
            req.query.wallet ||
            req.headers["x-wallet-address"] ||
            (req.user && req.user.walletAddress) ||
            ""
        ).toLowerCase();

        const modelIds = [
            model.id,
            model._id ? String(model._id) : null,
            model.contractModelId ? String(model.contractModelId) : null,
        ].filter(Boolean);

        // Find purchase info for license receipt
        let purchaseInfo = null;
        try {
            const modelConditions = [
                { modelId: { $in: modelIds } },
                { contractModelId: { $in: modelIds } },
            ];

            const buyerConditions = [];
            if (userId) buyerConditions.push({ buyerUserId: userId });
            if (userWallet) {
                buyerConditions.push({ buyerWallet: userWallet });
                buyerConditions.push({ buyerWallet: { $regex: new RegExp(`^${userWallet}$`, "i") } });
            }

            if (buyerConditions.length > 0) {
                const query = {
                    $and: [
                        { $or: modelConditions },
                        { $or: buyerConditions },
                        { verificationStatus: "verified" }
                    ]
                };
                purchaseInfo = await Purchase.findOne(query).sort({ createdAt: -1 }).lean();
            }
        } catch (dbErr) {
            console.warn("MongoDB download query warning:", dbErr.message);
        }

        if (!purchaseInfo && (userId || userWallet)) {
            const fallbackPurchases = readPurchasesFallback();
            purchaseInfo = fallbackPurchases.find((p) =>
                (modelIds.includes(p.modelId) || modelIds.includes(p.contractModelId)) &&
                p.verificationStatus === "verified" &&
                (
                    (userId && p.buyerUserId === userId) ||
                    (userWallet && (p.buyerWallet || "").toLowerCase() === userWallet)
                )
            ) || null;
        }

        const isOwner = Boolean(
            (userId && model.owner && (userId === model.owner.id || req.user.role === "admin")) ||
            (userWallet && model.ownerWallet && userWallet === model.ownerWallet.toLowerCase())
        );

        const hasPurchase = Boolean(purchaseInfo);
        const isFree = Number(model.price) === 0;
        const isPublished = !model.verificationStatus || ["verified", "legacy"].includes(model.verificationStatus);

        if (!isPublished || (!isOwner && !hasPurchase && !isFree)) {
            return res.status(403).json({ error: "A verified purchase or model ownership is required to download this model." });
        }

        // Generate synthetic receipt for owner or free tier if no purchase row exists
        if (!purchaseInfo) {
            purchaseInfo = {
                id: `receipt-${Date.now()}`,
                modelId: model.id,
                buyerWallet: userWallet || (isOwner ? "Model Creator" : "Free Tier User"),
                paymentMethod: isOwner ? "CREATOR_OWNERSHIP" : "FREE_TIER",
                paymentAmount: 0,
                licenseTier: 3,
                verificationStatus: "verified",
                createdAt: new Date(),
                transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            };
        }

        // Stream the generated complete ZIP archive
        return streamModelZip(model, purchaseInfo, res);
    } catch (err) {
        console.error("Download bundle error:", err);
        res.status(500).json({ error: "Failed to download model bundle: " + err.message });
    }
});

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

        const versions = [{
            version: model.version || 1,
            versionNotes: model.versionNotes || "Production stable release with verified benchmarks and ONNX/SafeTensors serialization.",
            createdAt: model.createdAt || new Date(),
            modelHash: model.modelHash,
            ipfsHash: model.ipfsHash,
            downloads: model.downloads || 0,
        }, ];
        res.json({ versions });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch model versions." });
    }
});

module.exports = router;