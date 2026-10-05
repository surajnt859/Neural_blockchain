require("dotenv").config();

const mongoose = require("mongoose");
const Model = require("../models/Model");
const { getMarketplaceContract } = require("../services/marketplaceReader");

async function main() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

    try {
        const models = await Model.find({
            contractModelId: { $exists: true, $nin: [null, ""] },
        }).select("_id contractModelId").lean();
        const marketplace = getMarketplaceContract();
        const modelCount = Number(await marketplace.getModelCount());
        const validListingIds = new Set();

        for (let id = 1; id <= modelCount; id += 1) {
            try {
                await marketplace.getModel(id);
                validListingIds.add(String(id));
            } catch (error) {
                if (error.code === "CALL_EXCEPTION" && error.reason === "Model does not exist") {
                    continue;
                }
                throw error;
            }
        }

        const orphanIds = models
            .filter((model) => !validListingIds.has(String(model.contractModelId)))
            .map((model) => model._id);
        const result = orphanIds.length ?
            await Model.deleteMany({ _id: { $in: orphanIds } }) :
            { deletedCount: 0 };
        const metadataOnlyCount = await Model.countDocuments({
            $or: [
                { contractModelId: { $exists: false } },
                { contractModelId: null },
                { contractModelId: "" },
            ],
        });

        console.log(`Deleted ${result.deletedCount} orphan model record(s).`);
        console.log(`Preserved ${metadataOnlyCount} model record(s) without a contractModelId.`);
        console.log(`Current on-chain listing IDs: ${[...validListingIds].join(", ") || "(none)"}`);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error("Orphan model cleanup failed:", error.message);
    process.exitCode = 1;
});
