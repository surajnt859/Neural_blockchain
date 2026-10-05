require("dotenv").config();

const mongoose = require("mongoose");
const Model = require("../models/Model");
const { getMarketplaceContract } = require("../services/marketplaceReader");

async function main() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

    try {
        const currentListing = await getMarketplaceContract().getModel(1);
        const currentCid = currentListing.ipfsHash;
        const staleRecords = await Model.find({
            contractModelId: "1",
            ipfsHash: { $ne: currentCid },
        }).select("_id id ipfsHash").lean();

        if (staleRecords.length === 0) {
            console.log("No stale MongoDB records found for listing ID 1.");
            return;
        }

        const result = await Model.deleteMany({
            _id: { $in: staleRecords.map((record) => record._id) },
            contractModelId: "1",
            ipfsHash: { $ne: currentCid },
        });
        console.log(`Deleted ${result.deletedCount} stale MongoDB record(s) for listing ID 1.`);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error("Stale listing cleanup failed:", error.message);
    process.exitCode = 1;
});
