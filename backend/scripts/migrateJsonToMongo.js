const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");
const Model = require("../models/Model");
const ModelVersion = require("../models/ModelVersion");
const Purchase = require("../models/Purchase");
const Review = require("../models/Review");
const Proposal = require("../models/Proposal");

const { connectDB } = require("../config/db");

const DATA_DIR = path.join(__dirname, "../data");

// Helper to read JSON files
const readJsonFile = (filename) => {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filename}`);
      return [];
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return [];
  }
};

let stats = {
  users: 0,
  models: 0,
  modelVersions: 0,
  purchases: 0,
  reviews: 0,
  proposals: 0,
  errors: [],
};

async function migrateUsers() {
  console.log("\n📝 Migrating Users...");
  const users = readJsonFile("users.json");

  for (const user of users) {
    try {
      // Use the existing application ID
      await User.updateOne(
        { id: user.id },
        {
          id: user.id,
          username: user.username,
          email: user.email,
          passwordHash: user.password || "",
          walletAddress: user.walletAddress || null,
          role: user.role || "buyer",
          isSellerVerified: user.isSellerVerified || false,
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          updatedAt: new Date(),
        },
        { upsert: true }
      );
      stats.users++;
    } catch (error) {
      stats.errors.push(`User ${user.id}: ${error.message}`);
      console.error(`❌ Error migrating user ${user.id}:`, error.message);
    }
  }

  console.log(`✅ Migrated ${stats.users} users`);
}

async function migrateModelsAndPurchases() {
  console.log("\n📦 Migrating Models and Purchases...");
  const models = readJsonFile("models.json");

  for (const model of models) {
    try {
      // Migrate the model
      await Model.updateOne(
        { id: model.id },
        {
          id: model.id,
          name: model.name,
          description: model.description,
          category: model.category,
          owner: model.owner || {},
          ownerWallet: model.ownerWallet || null,
          price: model.price || 0,
          ipfsHash: model.ipfsHash || null,
          modelHash: model.modelHash || null,
          verificationStatus: model.verificationStatus || "pending",
          verificationScore: model.verificationScore || 0,
          framework: model.framework || "Unknown",
          modelFormat: model.modelFormat || "Unknown",
          verificationChecks: model.verificationChecks || null,
          verificationWarnings: model.verificationWarnings || [],
          contractModelId: model.contractModelId || null,
          blockchainTxHash: model.blockchainTxHash || null,
          version: model.version || 1,
          parentModelId: model.parentModelId || null,
          baseModelId: model.baseModelId || null,
          versionNotes: model.versionNotes || null,
          previousHash: model.previousHash || null,
          benchmarks: model.benchmarks || {},
          downloads: model.downloads || 0,
          rating: model.rating || "0",
          tags: model.tags || [],
          architecture: model.architecture,
          license: model.license,
          inputTypes: model.inputTypes || [],
          outputTypes: model.outputTypes || [],
          contextWindow: model.contextWindow,
          pricePerCall: model.pricePerCall,
          purchases: [], // Clear purchases array
          createdAt: model.createdAt ? new Date(model.createdAt) : new Date(),
          updatedAt: new Date(),
        },
        { upsert: true }
      );
      stats.models++;

      // Migrate purchases if they exist in the model
      if (model.purchases && Array.isArray(model.purchases)) {
        for (const purchase of model.purchases) {
          try {
            const sellerWallet = purchase.sellerWallet || model.ownerWallet || null;
            if (!sellerWallet) {
              stats.errors.push(
                `Purchase ${purchase.id || `${model.id}-${purchase.buyerWallet || "unknown"}`}: skipped because sellerWallet is unavailable in source data.`
              );
              continue;
            }

            await Purchase.updateOne(
              { id: purchase.id || `${model.id}-${purchase.buyerWallet}` },
              {
                id: purchase.id || `${model.id}-${purchase.buyerWallet}`,
                modelId: model.id,
                contractModelId: purchase.contractModelId || model.contractModelId || null,
                buyerUserId: purchase.buyerUserId || null,
                buyerWallet: purchase.buyerWallet,
                sellerWallet,
                paymentMethod: purchase.paymentMethod || "ETH",
                paymentAmount: purchase.paymentAmount || model.price || 0,
                transactionHash: purchase.transactionHash || null,
                verificationStatus: purchase.verificationStatus || "verified",
                verificationTime: purchase.verificationTime
                  ? new Date(purchase.verificationTime)
                  : new Date(),
                nftId: purchase.nftId || null,
                ipfsCID: purchase.ipfsCID || model.ipfsHash,
                modelHash: purchase.modelHash || model.modelHash,
                createdAt: purchase.createdAt ? new Date(purchase.createdAt) : new Date(),
              },
              { upsert: true }
            );
            stats.purchases++;
          } catch (error) {
            stats.errors.push(`Purchase ${purchase.id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      stats.errors.push(`Model ${model.id}: ${error.message}`);
      console.error(`❌ Error migrating model ${model.id}:`, error.message);
    }
  }

  console.log(`✅ Migrated ${stats.models} models`);
  console.log(`✅ Migrated ${stats.purchases} purchases`);
}

async function migrateModelVersions() {
  console.log("\n🧩 Migrating Model Versions...");
  const models = readJsonFile("models.json");

  for (const model of models) {
    try {
      const hasExplicitVersionMetadata =
        model.version != null ||
        model.parentModelId ||
        model.baseModelId ||
        model.previousHash ||
        model.versionNotes;

      if (hasExplicitVersionMetadata) {
        continue;
      }

      const versionId = `${model.id}-v1`;
      await ModelVersion.updateOne(
        { id: versionId },
        {
          id: versionId,
          modelId: model.id,
          version: 1,
          parentModelId: null,
          baseModelId: null,
          versionNotes: model.versionNotes || "Initial version",
          previousHash: model.previousHash || null,
          ipfsHash: model.ipfsHash || null,
          sha256Hash: model.modelHash || null,
          verificationStatus: model.verificationStatus || "pending",
          verificationScore: model.verificationScore || 0,
          price: model.price || 0,
          contractModelId: model.contractModelId || null,
          blockchainTxHash: model.blockchainTxHash || null,
          benchmarks: model.benchmarks || {},
          createdAt: model.createdAt ? new Date(model.createdAt) : new Date(),
        },
        { upsert: true }
      );
      stats.modelVersions++;
    } catch (error) {
      stats.errors.push(`ModelVersion ${model.id}: ${error.message}`);
      console.error(`❌ Error migrating model version for ${model.id}:`, error.message);
    }
  }

  console.log(`✅ Migrated ${stats.modelVersions} model versions`);
}

async function migrateReviews() {
  console.log("\n⭐ Migrating Reviews...");
  const reviews = readJsonFile("reviews.json");

  for (const review of reviews) {
    try {
      await Review.updateOne(
        { id: review.id },
        {
          id: review.id,
          modelId: review.modelId,
          userId: review.userId,
          walletAddress: review.walletAddress,
          rating: review.rating || 5,
          comment: review.comment || "",
          verifiedPurchase: review.verifiedPurchase || false,
          purchaseId: review.purchaseId || null,
          createdAt: review.createdAt ? new Date(review.createdAt) : new Date(),
          updatedAt: review.updatedAt ? new Date(review.updatedAt) : new Date(),
        },
        { upsert: true }
      );
      stats.reviews++;
    } catch (error) {
      stats.errors.push(`Review ${review.id}: ${error.message}`);
      console.error(`❌ Error migrating review ${review.id}:`, error.message);
    }
  }

  console.log(`✅ Migrated ${stats.reviews} reviews`);
}

async function migrateProposals() {
  console.log("\n🗳️  Migrating Proposals...");
  const proposals = readJsonFile("proposals.json");

  for (const proposal of proposals) {
    try {
      await Proposal.updateOne(
        { id: proposal.id },
        {
          id: proposal.id,
          title: proposal.title,
          description: proposal.description,
          creator: proposal.creator,
          creatorWallet: proposal.creatorWallet || proposal.creator,
          forVotes: proposal.forVotes || 0,
          againstVotes: proposal.againstVotes || 0,
          abstainVotes: proposal.abstainVotes || 0,
          voters: proposal.voters || [],
          votingDeadline: proposal.deadline ? new Date(proposal.deadline) : new Date(),
          status: proposal.status || "Active",
          createdAt: proposal.createdAt ? new Date(proposal.createdAt) : new Date(),
        },
        { upsert: true }
      );
      stats.proposals++;
    } catch (error) {
      stats.errors.push(`Proposal ${proposal.id}: ${error.message}`);
      console.error(`❌ Error migrating proposal ${proposal.id}:`, error.message);
    }
  }

  console.log(`✅ Migrated ${stats.proposals} proposals`);
}

async function runMigration() {
  try {
    console.log("🚀 Starting JSON to MongoDB migration...\n");
    await connectDB();

    await migrateUsers();
    await migrateModelsAndPurchases();
    await migrateModelVersions();
    await migrateReviews();
    await migrateProposals();

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Users migrated:      ${stats.users}`);
    console.log(`✅ Models migrated:     ${stats.models}`);
    console.log(`✅ Model versions:      ${stats.modelVersions}`);
    console.log(`✅ Purchases migrated:  ${stats.purchases}`);
    console.log(`✅ Reviews migrated:    ${stats.reviews}`);
    console.log(`✅ Proposals migrated:  ${stats.proposals}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.slice(0, 10).forEach((err) => console.log(`   - ${err}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }

    console.log("=".repeat(60));
    console.log("✅ Migration completed!\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();
