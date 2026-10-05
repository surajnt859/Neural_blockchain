const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Model = require("../models/Model");
const { connectDB } = require("../config/db");
const { REAL_AI_MODELS } = require("../services/modelBundles");

const MODELS_FILE = path.join(__dirname, "../data/models.json");

async function seedModels() {
  console.log("⚡ Connecting to database...");
  try {
    await connectDB();
  } catch (err) {
    console.warn("⚠️ MongoDB connection notice:", err.message);
  }

  const seededModels = [];

  for (const raw of REAL_AI_MODELS) {

    const payload = {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      category: raw.category,
      owner: {
        id: "owner-neural-labs",
        username: "NeuralLabs Core",
        email: "research@neurallabs.ai",
      },
      ownerWallet: null,
      price: raw.price,
      ipfsHash: null,
      modelHash: null,
      verificationStatus: "unverified",
      verificationScore: 0,
      framework: raw.framework,
      modelFormat: raw.modelFormat,
      verificationChecks: null,
      verificationWarnings: ["Prototype seed record; no file or on-chain listing exists."],
      contractModelId: null,
      blockchainTxHash: null,
      version: 1,
      versionNotes: "Local prototype catalog fixture.",
      tags: raw.tags,
      benchmarks: raw.benchmarks,
      architecture: raw.architecture,
      license: raw.license,
      inputTypes: raw.inputTypes,
      outputTypes: raw.outputTypes,
      contextWindow: raw.contextWindow,
      pricePerCall: raw.pricePerCall,
      downloads: 0,
      rating: "0",
      purchases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await Model.updateOne({ id: raw.id }, payload, { upsert: true });
    } catch (mErr) {}

    seededModels.push(payload);
  }

  // Update models.json fallback as well
  try {
    fs.writeFileSync(MODELS_FILE, JSON.stringify(seededModels, null, 2));
    console.log(`💾 Saved ${seededModels.length} models to ${MODELS_FILE}`);
  } catch (fErr) {
    console.warn("Could not write models.json:", fErr.message);
  }

  console.log("Prototype catalog fixtures saved; no on-chain listings or purchases were created.");
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(0);
}

seedModels().catch((err) => {
  console.error(err);
  process.exit(1);
});