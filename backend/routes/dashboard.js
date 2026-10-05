const express = require("express");
const fs = require("fs");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const { toDisplayPaymentAmount } = require("../utils/paymentAmount");
const { REAL_AI_MODELS } = require("../services/modelBundles");

const Model = require("../models/Model");
const User = require("../models/User");
const Purchase = require("../models/Purchase");
const Review = require("../models/Review");

const router = express.Router();
const MODELS_FILE = path.join(__dirname, "../data/models.json");
const PURCHASES_FILE = path.join(__dirname, "../data/purchases.json");
const USERS_FILE = path.join(__dirname, "../data/users.json");

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

// Helper to read fallback users from JSON
const readUsersFallback = () => {
    try {
        if (fs.existsSync(USERS_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
        }
    } catch (e) {
        console.warn("Could not read users.json fallback:", e.message);
    }
    return [];
};

function accumulatePurchaseAmounts(purchase, totals, modelSalesMap) {
    const amount = toDisplayPaymentAmount(purchase.paymentAmount, purchase.paymentMethod);
    if (purchase.buyerWallet) totals.uniqueBuyers.add(purchase.buyerWallet.toLowerCase());

    if (!modelSalesMap[purchase.modelId]) {
        modelSalesMap[purchase.modelId] = { salesCount: 0, ethRevenue: 0, neuralRevenue: 0 };
    }
    modelSalesMap[purchase.modelId].salesCount += 1;

    if (purchase.paymentMethod === "ETH") {
        totals.ethRevenue += amount;
        modelSalesMap[purchase.modelId].ethRevenue += amount;
    } else if (purchase.paymentMethod === "NEURAL") {
        totals.neuralRevenue += amount;
        modelSalesMap[purchase.modelId].neuralRevenue += amount;
    }
}

// Creator royalty: 90% to creator, 10% to platform protocol fee
const CREATOR_ROYALTY_RATE = 0.9;

function applyRoyaltySplit(grossAmount) {
    const creatorShare = grossAmount * CREATOR_ROYALTY_RATE;
    const platformShare = grossAmount * (1 - CREATOR_ROYALTY_RATE);
    return { creatorShare, platformShare };
}

// GET /api/dashboard/platform-stats — platform-wide statistics
router.get("/platform-stats", async(req, res) => {
    try {
        let totalModels = 6;
        let purchases = [];
        let usersCount = 10;

        try {
            totalModels = await Model.countDocuments();
            purchases = await Purchase.find({ verificationStatus: "verified" });
            usersCount = await User.countDocuments();
        } catch (e) {
            console.warn("Using fallback platform stats:", e.message);
        }

        if (purchases.length === 0) {
            purchases = readPurchasesFallback().filter((p) => p.verificationStatus === "verified");
        }

        const fallbackModels = readModelsFallback();
        totalModels = Math.max(totalModels, fallbackModels.length, 6);

        let totalRevenue = 0;
        let ethRevenue = 0;
        let neuralRevenue = 0;

        purchases.forEach((purchase) => {
            const amount = Number(purchase.paymentAmount) || 0;
            totalRevenue += amount;
            if (purchase.paymentMethod === "ETH") {
                ethRevenue += amount;
            } else if (purchase.paymentMethod === "NEURAL") {
                neuralRevenue += amount;
            }
        });

        res.json({
            totalModels,
            modelsSold: purchases.length,
            verifiedTransactions: purchases.length,
            transactions: purchases.length,
            activeUsers: Math.max(usersCount, 1),
            totalRevenue,
            ethRevenue,
            neuralRevenue,
            creatorRoyalties: totalRevenue * CREATOR_ROYALTY_RATE,
            platformRevenue: totalRevenue * (1 - CREATOR_ROYALTY_RATE),
            totalValueLocked: null,
        });
    } catch (err) {
        console.error("Error fetching platform stats:", err.message);
        res.status(500).json({ error: "Failed to fetch platform statistics." });
    }
});

const { optionalAuth } = authMiddleware;

// GET /api/dashboard — user & creator dashboard
router.get("/", optionalAuth, async(req, res) => {
    try {
        const userId = (req.user && req.user.id) || null;
        let user = null;
        let myModels = [];
        let userPurchases = [];
        let myPurchases = [];
        let myReviews = [];

        const allFallbackModels = readModelsFallback();
        const allFallbackPurchases = readPurchasesFallback();
        const allFallbackUsers = readUsersFallback();

        const queryWallet = req.query.wallet ? req.query.wallet.toLowerCase() : null;

        const walletList = [
            user && user.walletAddress,
            req.user && req.user.walletAddress,
            queryWallet,
        ].filter(Boolean).map((w) => w.toLowerCase());

        try {
            if (userId) {
                user = await User.findOne({ id: userId }).select("-passwordHash");
            }

            const modelQueryConditions = [];
            if (userId) modelQueryConditions.push({ "owner.id": userId });
            if (walletList.length > 0) {
                modelQueryConditions.push({ ownerWallet: { $in: walletList } });
                modelQueryConditions.push({ "owner.walletAddress": { $in: walletList } });
            }

            if (modelQueryConditions.length > 0) {
                myModels = await Model.find({
                    archived: { $ne: true },
                    $or: modelQueryConditions,
                }).lean();
            }
        } catch (dbErr) {
            console.warn("Dashboard Mongo user/models lookup warning:", dbErr.message);
        }

        if (!user && userId) {
            user = allFallbackUsers.find((u) => u.id === userId) || null;
        }

        // Merge and deduplicate fallback uploaded models
        if (userId || walletList.length > 0) {
            const matchedFallbackModels = allFallbackModels.filter((m) =>
                !m.archived && (
                    (userId && m.owner && m.owner.id === userId) ||
                    (walletList.length > 0 && m.ownerWallet && walletList.includes(m.ownerWallet.toLowerCase())) ||
                    (walletList.length > 0 && m.owner && m.owner.walletAddress && walletList.includes(m.owner.walletAddress.toLowerCase()))
                )
            );

            const existingModelIds = new Set(myModels.map((m) => m.id));
            matchedFallbackModels.forEach((fm) => {
                if (!existingModelIds.has(fm.id)) {
                    myModels.push(fm);
                    existingModelIds.add(fm.id);
                }
            });
        }

        // Try MongoDB for purchases
        try {
            if (userId || walletList.length > 0) {
                const buyerOrs = [];
                if (userId) buyerOrs.push({ buyerUserId: userId });
                walletList.forEach((w) => {
                    buyerOrs.push({ buyerWallet: w });
                    buyerOrs.push({ buyerWallet: { $regex: new RegExp(`^${w}$`, "i") } });
                });

                userPurchases = await Purchase.find({
                    verificationStatus: "verified",
                    $or: buyerOrs,
                }).sort({ createdAt: -1 });
            }

            const myModelIds = myModels.map((m) => m.id);
            if (myModelIds.length > 0) {
                myPurchases = await Purchase.find({
                    modelId: { $in: myModelIds },
                    verificationStatus: "verified",
                });
                myReviews = await Review.find({
                    modelId: { $in: myModelIds },
                    verifiedPurchase: true,
                });
            }
        } catch (dbErr) {
            console.warn("Dashboard Mongo purchases fetch warning:", dbErr.message);
        }

        // Merge fallback purchases
        if (userId || walletList.length > 0) {
            const matchedFallbackPurchases = allFallbackPurchases.filter((p) =>
                p.verificationStatus === "verified" &&
                ((userId && p.buyerUserId === userId) || (walletList.length > 0 && walletList.includes((p.buyerWallet || "").toLowerCase())))
            );

            // Deduplicate by ID
            const existingIds = new Set(userPurchases.map((p) => p.id));
            matchedFallbackPurchases.forEach((fp) => {
                if (!existingIds.has(fp.id)) {
                    userPurchases.push(fp);
                    existingIds.add(fp.id);
                }
            });

            // If creator model sales are in fallback
            const myModelIds = new Set(myModels.map((m) => m.id));
            const existingSalesIds = new Set(myPurchases.map((p) => p.id));
            allFallbackPurchases.forEach((fp) => {
                if (myModelIds.has(fp.modelId) && fp.verificationStatus === "verified" && !existingSalesIds.has(fp.id)) {
                    myPurchases.push(fp);
                    existingSalesIds.add(fp.id);
                }
            });
        }

        // Map purchased models
        const purchasedModelIds = [...new Set(userPurchases.map((p) => p.modelId))];
        let purchasedModelDocs = [];
        try {
            if (purchasedModelIds.length) {
                purchasedModelDocs = await Model.find({ id: { $in: purchasedModelIds } });
            }
        } catch (e) {}

        const purchasedModelById = Object.fromEntries(purchasedModelDocs.map((m) => [m.id, m]));

        const purchasedModels = userPurchases
            .map((purchase) => {
                let model = purchasedModelById[purchase.modelId];
                if (!model) {
                    model = allFallbackModels.find((m) => m.id === purchase.modelId) || REAL_AI_MODELS.find((m) => m.id === purchase.modelId);
                }
                if (!model) return null;

                const paymentAmountDisplay = toDisplayPaymentAmount(
                    purchase.paymentAmount,
                    purchase.paymentMethod
                );

                return {
                    id: model.id,
                    name: model.name,
                    category: model.category,
                    creator: (model.owner && model.owner.username) || "NeuralChain Creator",
                    paymentMethod: purchase.paymentMethod,
                    paymentAmountDisplay,
                    purchaseDate: purchase.createdAt,
                    transactionHash: purchase.transactionHash || null,
                    verificationStatus: purchase.verificationStatus,
                    downloadUrl: `/api/models/${model.id}/download`,
                    nftId: purchase.nftId || model.contractModelId || "1",
                    modelFormat: model.modelFormat,
                    framework: model.framework,
                    ipfsCID: purchase.ipfsCID || model.ipfsHash,
                    modelHash: purchase.modelHash || model.modelHash,
                    benchmarks: model.benchmarks,
                };
            })
            .filter(Boolean);

        const totals = { ethRevenue: 0, neuralRevenue: 0, uniqueBuyers: new Set() };
        const modelSalesMap = {};

        myPurchases.forEach((purchase) => {
            accumulatePurchaseAmounts(purchase, totals, modelSalesMap);
        });

        const { ethRevenue, neuralRevenue, uniqueBuyers } = totals;
        const ethRoyalty = applyRoyaltySplit(ethRevenue);
        const neuralRoyalty = applyRoyaltySplit(neuralRevenue);

        const creatorRoyaltyRevenue = ethRoyalty.creatorShare;
        const neuralCreatorRoyalty = neuralRoyalty.creatorShare;
        const totalReviews = myReviews.length;
        const averageRating =
            totalReviews > 0 ?
            Number((myReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1)) :
            5.0;

        const verifiedModelsCount = myModels.filter((m) => m.verificationStatus === "verified").length;
        const blockchainListedCount = myModels.filter((m) => Boolean(m.contractModelId)).length;
        const legacyModelsCount = myModels.filter((m) => !m.contractModelId).length;

        let legacyRecordedDownloads = 0;
        let blockchainRecordedDownloads = 0;
        myModels.forEach((m) => {
            const count = Number(m.downloads) || 0;
            if (m.contractModelId) {
                blockchainRecordedDownloads += count;
            } else {
                legacyRecordedDownloads += count;
            }
        });
        const totalDownloads = legacyRecordedDownloads + blockchainRecordedDownloads;

        const username =
            (user && user.username) ||
            (req.user && req.user.username) ||
            (walletList.length > 0 ? `0x${walletList[0].slice(2, 6)}...${walletList[0].slice(-4)}` : "Web3 Developer");

        const stats = {
            modelCount: myModels.length,
            verifiedModelsCount,
            blockchainListedCount,
            legacyModelsCount,
            verifiedSales: myPurchases.length,
            ethSales: myPurchases.filter((p) => p.paymentMethod === "ETH").length,
            neuralSales: myPurchases.filter((p) => p.paymentMethod === "NEURAL").length,
            ethRevenue,
            neuralRevenue,
            creatorRoyaltyRevenue,
            neuralCreatorRoyalty,
            ethPlatformShare: ethRoyalty.platformShare,
            neuralPlatformShare: neuralRoyalty.platformShare,
            uniqueBuyers: uniqueBuyers.size,
            reviewsCount: totalReviews,
            averageRating,
            totalDownloads,
            legacyRecordedDownloads,
            blockchainRecordedDownloads,
            walletAddress: (user && user.walletAddress) || (req.user && req.user.walletAddress) || queryWallet || null,
            username,
        };

        const modelsWithMetrics = myModels.map((m) => {
            const salesInfo = modelSalesMap[m.id] || { salesCount: 0, ethRevenue: 0, neuralRevenue: 0 };
            const modelEthRoyalty = applyRoyaltySplit(salesInfo.ethRevenue);
            const modelNeuralRoyalty = applyRoyaltySplit(salesInfo.neuralRevenue);
            const doc = typeof m.toObject === "function" ? m.toObject() : m;
            return {
                ...doc,
                verifiedSales: salesInfo.salesCount,
                verifiedEthRevenue: salesInfo.ethRevenue,
                verifiedNeuralRevenue: salesInfo.neuralRevenue,
                ethCreatorRoyalty: modelEthRoyalty.creatorShare,
                neuralCreatorRoyalty: modelNeuralRoyalty.creatorShare,
                isBlockchainListed: Boolean(m.contractModelId),
                isLegacyListing: !m.contractModelId,
            };
        });

        res.json({
            stats,
            myModels: modelsWithMetrics,
            purchasedModels,
        });
    } catch (err) {
        console.error("Error fetching dashboard:", err.message);
        res.status(500).json({ error: "Failed to fetch dashboard data." });
    }
});

module.exports = router;