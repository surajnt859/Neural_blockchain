const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/authMiddleware");
const Model = require("../models/Model");

const router = express.Router();
router.use(authMiddleware, requireRole("admin"));

router.get("/models", async(req, res) => {
    try {
        const models = await Model.find({
            verificationStatus: { $in: ["pending", "needs_review", "rejected"] },
        }).sort({ updatedAt: -1 }).lean();
        return res.json({ models });
    } catch (err) {
        console.error("Admin moderation queue error:", err.message);
        return res.status(500).json({ error: "Failed to load moderation queue." });
    }
});

router.patch("/models/:id/moderation", async(req, res) => {
    const { status, note } = req.body || {};
    const allowedStatuses = ["verified", "rejected", "needs_review"];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Status must be verified, rejected, or needs_review." });
    }

    try {
        const model = await Model.findOneAndUpdate({ id: req.params.id }, {
            $set: {
                verificationStatus: status,
                moderationNote: typeof note === "string" ? note.slice(0, 2000) : "",
                moderatedBy: req.user.id,
                moderatedAt: new Date(),
                updatedAt: new Date(),
            },
        }, { new: true, runValidators: true }).lean();

        if (!model) return res.status(404).json({ error: "Model not found." });
        return res.json({ message: `Model ${status}.`, model });
    } catch (err) {
        console.error("Admin moderation update error:", err.message);
        return res.status(500).json({ error: "Failed to update model moderation status." });
    }
});

module.exports = router;