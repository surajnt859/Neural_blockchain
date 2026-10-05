const express = require("express");

const Model = require("../models/Model");
const Review = require("../models/Review");
const Purchase = require("../models/Purchase");

const router = express.Router();

const reputationLevel = (score) => {
  if (score >= 95) return "Top Developer";
  if (score >= 80) return "Highly Trusted";
  if (score >= 60) return "Trusted Developer";
  if (score >= 40) return "Rising Developer";
  return "New Developer";
};

// GET /api/leaderboard/models — top models by engagement
// Rating source: live average of verified reviews (verifiedPurchase === true).
// Falls back to 0 when no verified reviews exist — never uses Model.rating string.
router.get("/models", async (req, res) => {
  try {
    const [models, reviews] = await Promise.all([
      Model.find(),
      Review.find({ verifiedPurchase: true }),
    ]);

    // Build per-model verified-review average map
    // { [modelId]: { total: Number, count: Number } }
    const reviewMap = {};
    reviews.forEach((r) => {
      if (!reviewMap[r.modelId]) reviewMap[r.modelId] = { total: 0, count: 0 };
      reviewMap[r.modelId].total += Number(r.rating) || 0;
      reviewMap[r.modelId].count += 1;
    });

    // Attach live rating to each model and rank by (liveRating × downloads), descending
    const ranked = models
      .map((m) => {
        const rdata = reviewMap[m.id];
        const liveRating = rdata && rdata.count > 0
          ? Number((rdata.total / rdata.count).toFixed(2))
          : 0;
        const reviewCount = rdata ? rdata.count : 0;
        const rankScore = liveRating * (m.downloads || 0);
        return { m, liveRating, reviewCount, rankScore };
      })
      .sort((a, b) => b.rankScore - a.rankScore);

    // Return top 10 with only public fields and the canonical live rating
    const result = ranked.slice(0, 10).map(({ m, liveRating, reviewCount }) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      owner: { username: m.owner?.username || "Anonymous" },
      liveRating,         // average of verified Review ratings (Number); 0 when no reviews
      reviewCount,        // number of verified reviews used for the average
      downloads: m.downloads || 0,
      verificationStatus: m.verificationStatus,
      isBlockchainListed: Boolean(m.contractModelId),
      tags: m.tags || [],
    }));
    res.json(result);
  } catch (err) {
    console.error("Error fetching top models:", err.message);
    res.status(500).json({ error: "Failed to fetch top models." });
  }
});

// GET /api/leaderboard/creators — top creators by reputation
router.get("/creators", async (req, res) => {
  try {
    const models = await Model.find();
    const reviews = await Review.find({ verifiedPurchase: true });
    const purchases = await Purchase.find({ verificationStatus: "verified" });

    const creatorsMap = {};

    // Initialize creator stats from models
    models.forEach((m) => {
      const creator = m.owner?.username || "Anonymous";
      if (!creatorsMap[creator]) {
        creatorsMap[creator] = {
          username: creator,
          email: m.owner?.email,
          walletAddress: m.ownerWallet,
          totalEarnings: 0,
          modelCount: 0,
          totalDownloads: 0,
          verifiedModels: 0,
          sales: 0,
          reviews: 0,
          ratingTotal: 0,
          ratingCount: 0,
        };
      }
      const creatorStats = creatorsMap[creator];
      creatorStats.modelCount += 1;
      creatorStats.verifiedModels += m.verificationStatus === "verified" ? 1 : 0;
      creatorStats.totalDownloads += Number(m.downloads) || 0;
    });

    // Count verified purchases for each model and creator
    purchases.forEach((purchase) => {
      const model = models.find((m) => m.id === purchase.modelId);
      if (model) {
        const creator = model.owner?.username || "Anonymous";
        if (creatorsMap[creator]) {
          creatorsMap[creator].sales += 1;
          creatorsMap[creator].totalEarnings += Number(purchase.paymentAmount) || 0;
        }
      }
    });

    // Aggregate reviews by creator
    reviews.forEach((review) => {
      const model = models.find((m) => m.id === review.modelId);
      const creator = model?.owner?.username;
      if (creator && creatorsMap[creator]) {
        creatorsMap[creator].reviews += 1;
        creatorsMap[creator].ratingTotal += Number(review.rating) || 0;
        creatorsMap[creator].ratingCount += 1;
      }
    });

    // Calculate reputation score for each creator
    const rankedCreators = Object.values(creatorsMap)
      .map((creator) => {
        const averageRating = creator.ratingCount ? creator.ratingTotal / creator.ratingCount : 0;
        const verifiedModelRate = creator.modelCount ? creator.verifiedModels / creator.modelCount : 0;

        // Reputation score formula:
        // 30% average rating, 25% verified models, 20% sales, 15% downloads, 10% reviews
        const ratingScore = (averageRating / 5) * 30;
        const verificationScore = verifiedModelRate * 25;
        const salesScore = Math.min(creator.sales / 100, 1) * 20;
        const downloadScore = Math.min(creator.totalDownloads / 10000, 1) * 15;
        const reviewScore = Math.min(creator.reviews / 100, 1) * 10;
        const reputationScore = Math.round(ratingScore + verificationScore + salesScore + downloadScore + reviewScore);

        // Only return public leaderboard fields — no private email or wallet
        return {
          username: creator.username,
          modelCount: creator.modelCount,
          verifiedModels: creator.verifiedModels,
          totalDownloads: creator.totalDownloads,
          sales: creator.sales,
          reviews: creator.reviews,
          averageRating: Number(averageRating.toFixed(1)),
          reputationScore,
          trustLevel: reputationLevel(reputationScore),
        };
      })
      .sort((a, b) => b.reputationScore - a.reputationScore || b.averageRating - a.averageRating);

    res.json(rankedCreators.slice(0, 10));
  } catch (err) {
    console.error("Error fetching creator leaderboard:", err.message);
    res.status(500).json({ error: "Failed to fetch creator leaderboard." });
  }
});

module.exports = router;
