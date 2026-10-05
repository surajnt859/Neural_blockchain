const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const Model = require("../models/Model");
const Review = require("../models/Review");
const Purchase = require("../models/Purchase");

const router = express.Router();

function summarize(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((review) => {
    distribution[review.rating]++;
  });
  const total = reviews.length;
  return {
    average: total ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / total).toFixed(1)) : 0,
    total,
    distribution,
  };
}

// GET /api/models/:id/reviews — public review list and aggregate ratings
router.get("/:id/reviews", async (req, res) => {
  try {
    const reviews = await Review.find({ modelId: req.params.id });
    res.json({ reviews, summary: summarize(reviews) });
  } catch (err) {
    console.error("Error fetching reviews:", err.message);
    res.status(500).json({ error: "Failed to fetch reviews." });
  }
});

// POST /api/models/:id/reviews — only verified purchasers may review once
router.post("/:id/reviews", authMiddleware, async (req, res) => {
  try {
    const model = await Model.findOne({ id: req.params.id });
    if (!model) return res.status(404).json({ error: "Model not found." });

    // Check if user has a verified purchase
    const verifiedPurchase = await Purchase.findOne({
      modelId: model.id,
      buyerUserId: req.user.id,
      verificationStatus: "verified",
    });

    if (!verifiedPurchase) {
      return res.status(403).json({
        error: "Only buyers with a verified blockchain purchase can review this model.",
      });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      modelId: model.id,
      userId: req.user.id,
    });

    if (existingReview) {
      return res.status(409).json({ error: "You have already reviewed this model." });
    }

    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";

    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ error: "Rating must be an integer from 1 to 5." });
    if (comment.length < 10 || comment.length > 1000)
      return res.status(400).json({ error: "Review must be between 10 and 1000 characters." });

    const review = new Review({
      id: `review-${Date.now()}`,
      modelId: model.id,
      userId: req.user.id,
      walletAddress: verifiedPurchase.buyerWallet,
      rating,
      comment,
      verifiedPurchase: true,
      purchaseId: verifiedPurchase.id,
      createdAt: new Date(),
    });

    await review.save();

    const allReviews = await Review.find({ modelId: model.id });
    res.status(201).json({ review, summary: summarize(allReviews) });
  } catch (err) {
    console.error("Error saving review:", err.message);
    res.status(500).json({ error: "Failed to save review." });
  }
});

module.exports = router;