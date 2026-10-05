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
        modelSalesMap[purchase.modelId] = {
            salesCount: 0,
            ethRevenue: 0,
            neuralRevenue: 0,
            ethCreatorShare: 0,
            neuralCreatorShare: 0,
        };
    }
    modelSalesMap[purchase.modelId].salesCount += 1;
    const split = applyPrimarySaleSplit(amount, Boolean(purchase.parentModelId));

    if (purchase.paymentMethod === "ETH") {
        totals.ethRevenue += amount;
        modelSalesMap[purchase.modelId].ethRevenue += amount;
        totals.ethCreatorShare += split.creatorShare;
        modelSalesMap[purchase.modelId].ethCreatorShare += split.creatorShare;
    } else if (purchase.paymentMethod === "NEURAL") {
        totals.neuralRevenue += amount;
        modelSalesMap[purchase.modelId].neuralRevenue += amount;
        totals.neuralCreatorShare += split.creatorShare;
        modelSalesMap[purchase.modelId].neuralCreatorShare += split.creatorShare;
    }
}

function applyPrimarySaleSplit(grossAmount, hasParentLineage) {
    const creatorShare = grossAmount * (hasParentLineage ? 0.8 : 0.9);
    const platformShare = grossAmount * 0.1;
    return { creatorShare, platformShare };
}

// GET /api/dashboard/platform-stats — platform-wide statistics
router.get("/platform-stats", async(req, res) => {
    try {
        const [totalModels, purchases, usersCount] = await Promise.all([
            Model.countDocuments({ contractModelId: { $ne: null } }),
            Purchase.find({
                verificationStatus: "verified",
                verificationMode: "chain",
                transactionHash: /^0x[a-fA-F0-9]{64}$/,
            }).lean(),
            User.countDocuments(),
        ]);
        let ethRevenue = 0;
        let neuralRevenue = 0;
        let ethCreatorPrimarySaleShare = 0;
        let neuralCreatorPrimarySaleShare = 0;

        purchases.forEach((purchase) => {
            const amount = Number(purchase.paymentAmount) || 0;
            if (purchase.paymentMethod === "ETH") {
                ethRevenue += amount;
                ethCreatorPrimarySaleShare += applyPrimarySaleSplit(amount, Boolean(purchase.parentModelId)).creatorShare;
            } else if (purchase.paymentMethod === "NEURAL") {
                neuralRevenue += amount;
                neuralCreatorPrimarySaleShare += applyPrimarySaleSplit(amount, Boolean(purchase.parentModelId)).creatorShare;
            }
        });

        res.json({
            totalModels,
            modelsSold: purchases.length,
            verifiedTransactions: purchases.length,
            transactions: purchases.length,
            activeUsers: usersCount,
            ethRevenue,
            neuralRevenue,
            ethCreatorPrimarySaleShare,
            neuralCreatorPrimarySaleShare,
        });
    } catch (err) {
        console.error("Error fetching platform stats:", err.message);
        res.status(500).json({ error: "Failed to fetch platform statistics." });
    }
});

// GET /api/dashboard — user & creator dashboard
router.get("/", authMiddleware, async(req, res) => {
    try {
        const userId = (req.user && req.user.id) || null;
        let user = null;
        let myModels = [];
        let userPurchases = [];
        let myPurchases = [];
        let myReviews = [];

        const allFallbackModels = readModelsFallback();
        const allFallbackUsers = readUsersFallback();
        const walletList = [];

        try {
            if (userId) {
                user = await User.findOne({ id: userId }).select("-passwordHash");
            }
            if (user && user.walletVerified && user.walletAddress) walletList.push(user.walletAddress.toLowerCase());

            if (walletList.length > 0) {
                myModels = await Model.find({
                    archived: { $ne: true },
                    ownerWallet: { $in: walletList },
                }).lean();
            }
        } catch (dbErr) {
            console.warn("Dashboard Mongo user/models lookup warning:", dbErr.message);
        }

        if (!user && userId) {
            user = allFallbackUsers.find((u) => u.id === userId) || null;
        }
        if (user && user.walletVerified && user.walletAddress && !walletList.includes(user.walletAddress.toLowerCase())) {
            walletList.push(user.walletAddress.toLowerCase());
        }

        // Only include records belonging to the authenticated user's stored, signature-verified wallet.
        if (walletList.length > 0) {
            const matchedFallbackModels = allFallbackModels.filter((m) =>
                !m.archived &&
                m.ownerWallet &&
                walletList.includes(m.ownerWallet.toLowerCase())
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
                    verificationMode: "chain",
                    transactionHash: /^0x[a-fA-F0-9]{64}$/,
                    $or: buyerOrs,
                }).sort({ createdAt: -1 });
            }

            const myModelIds = myModels.map((m) => m.id);
            if (myModelIds.length > 0) {
                myPurchases = await Purchase.find({
                    modelId: { $in: myModelIds },
                    verificationStatus: "verified",
                    verificationMode: "chain",
                    transactionHash: /^0x[a-fA-F0-9]{64}$/,
                });
                myReviews = await Review.find({
                    modelId: { $in: myModelIds },
                    verifiedPurchase: true,
                });
            }
        } catch (dbErr) {
            console.warn("Dashboard Mongo purchases fetch warning:", dbErr.message);
        }

        // Map purchased models
        const purchasedModelIds = [...new Set(userPurchases.map((p) => p.modelId))];
        let purchasedModelDocs = [];
        try {
            if (purchasedModelIds.length) {
                purchasedModelDocs = await Model.find({ id: { $in: purchasedModelIds } });
            }
        } catch (error) {
            console.warn("Dashboard purchased-model metadata lookup failed:", error.message);
        }

        const purchasedModelById = Object.fromEntries(purchasedModelDocs.map((m) => [m.id, m]));

        const purchasedModels = userPurchases
            .map((purchase) => {
                let model = purchasedModelById[purchase.modelId];
                if (!model) {
                    model = allFallbackModels.find((m) => m.id === purchase.modelId);
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
                    creator: (model.owner && model.owner.username) || "Unknown creator",
                    paymentMethod: purchase.paymentMethod,
                    paymentAmountDisplay,
                    purchaseDate: purchase.createdAt,
                    transactionHash: purchase.transactionHash || null,
                    verificationStatus: purchase.verificationStatus,
                    nftId: purchase.nftId || model.contractModelId || null,
                    fileName: model.fileName || null,
                    modelFormat: model.modelFormat,
                    framework: model.framework,
                    ipfsCID: purchase.ipfsCID || model.ipfsHash,
                    modelHash: purchase.modelHash || model.modelHash,
                    benchmarks: model.benchmarks,
                };
            })
            .filter(Boolean);

        const totals = {
            ethRevenue: 0,
            neuralRevenue: 0,
            ethCreatorShare: 0,
            neuralCreatorShare: 0,
            uniqueBuyers: new Set(),
        };
        const modelSalesMap = {};

        myPurchases.forEach((purchase) => {
            accumulatePurchaseAmounts(purchase, totals, modelSalesMap);
        });

        const { ethRevenue, neuralRevenue, uniqueBuyers } = totals;
        const totalReviews = myReviews.length;
        const averageRating =
            totalReviews > 0 ?
            Number((myReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1)) :
            null;

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
            null;

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
            creatorPrimarySaleShare: totals.ethCreatorShare,
            neuralCreatorPrimarySaleShare: totals.neuralCreatorShare,
            uniqueBuyers: uniqueBuyers.size,
            reviewsCount: totalReviews,
            averageRating,
            totalDownloads,
            legacyRecordedDownloads,
            blockchainRecordedDownloads,
            walletAddress: (user && user.walletVerified && user.walletAddress) || null,
            username,
        };

        const modelsWithMetrics = myModels.map((m) => {
            const salesInfo = modelSalesMap[m.id] || {
                salesCount: 0,
                ethRevenue: 0,
                neuralRevenue: 0,
                ethCreatorShare: 0,
                neuralCreatorShare: 0,
            };
            const doc = typeof m.toObject === "function" ? m.toObject() : m;
            return {
                ...doc,
                verifiedSales: salesInfo.salesCount,
                verifiedEthRevenue: salesInfo.ethRevenue,
                verifiedNeuralRevenue: salesInfo.neuralRevenue,
                ethCreatorPrimarySaleShare: salesInfo.ethCreatorShare,
                neuralCreatorPrimarySaleShare: salesInfo.neuralCreatorShare,
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