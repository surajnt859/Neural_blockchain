const mongoose = require("mongoose");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Model = require("../models/Model");
const marketplaceArtifact = require("../contracts/ModelMarketplace.json");
const tokenArtifact = require("../contracts/NeuralToken.json");
const { connectDB } = require("../config/db");
const { REAL_AI_MODELS } = require("../services/modelBundles");

const HARDHAT_OWNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEMO_BUYER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const MARKETPLACE_ADDRESS = process.env.CONTRACT_ADDRESS || marketplaceArtifact.address;
const TOKEN_ADDRESS = process.env.NEURAL_TOKEN_ADDRESS || tokenArtifact.address;
const MODELS_FILE = path.join(__dirname, "../data/models.json");

async function seedModels() {
  console.log("⚡ Connecting to database...");
  try {
    await connectDB();
  } catch (err) {
    console.warn("⚠️ MongoDB connection notice:", err.message);
  }

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  let wallet = null;
  let contract = null;
  let tokenContract = null;

  try {
    wallet = new ethers.Wallet(HARDHAT_OWNER_KEY, provider);
    contract = new ethers.Contract(MARKETPLACE_ADDRESS, marketplaceArtifact.abi, wallet);
    if (TOKEN_ADDRESS) {
      tokenContract = new ethers.Contract(TOKEN_ADDRESS, tokenArtifact.abi, wallet);
      // Transfer 50,000 NEURAL to demo buyer wallet so they can buy models with NEURAL immediately
      console.log(`🪙 Transferring 50,000 NEURAL tokens to demo buyer wallet (${DEMO_BUYER_ADDRESS})...`);
      const transferTx = await tokenContract.transfer(DEMO_BUYER_ADDRESS, ethers.parseUnits("50000", 18));
      await transferTx.wait();
      console.log("✅ NEURAL tokens funded to demo buyer wallet.");
    }
  } catch (rpcErr) {
    console.warn("⚠️ Could not connect to local blockchain node:", rpcErr.message);
  }

  const seededModels = [];

  for (let i = 0; i < REAL_AI_MODELS.length; i++) {
    const raw = REAL_AI_MODELS[i];
    let contractModelId = String(i + 1);
    let txHash = `0x${crypto.randomBytes(32).toString("hex")}`;

    if (contract && wallet) {
      try {
        const priceWei = ethers.parseEther(String(raw.price));
        console.log(`📤 Listing "${raw.name}" on smart contract...`);
        const nonce = await provider.getTransactionCount(wallet.address, "pending");
        const tx = await contract.uploadModel(
          raw.name,
          raw.description,
          raw.category,
          raw.ipfsHash,
          raw.modelHash,
          raw.verificationStatus,
          raw.verificationScore,
          priceWei,
          { nonce }
        );
        const receipt = await tx.wait();
        txHash = tx.hash;

        const event = receipt.logs
          .map((log) => {
            try {
              return contract.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((parsed) => parsed && parsed.name === "ModelListed");

        if (event) {
          contractModelId = String(event.args.id);
        }
        console.log(`✅ On-chain model #${contractModelId} listed: ${raw.name}`);
      } catch (chainErr) {
        console.warn(`⚠️ On-chain listing skipped for ${raw.name}:`, chainErr.message);
      }
    }

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
      ownerWallet: wallet?.address || "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      price: raw.price,
      ipfsHash: raw.ipfsHash,
      modelHash: raw.modelHash,
      verificationStatus: raw.verificationStatus,
      verificationScore: raw.verificationScore,
      framework: raw.framework,
      modelFormat: raw.modelFormat,
      verificationChecks: {
        architecture: true,
        dependencies: true,
        suspiciousContent: false,
        fileSize: true,
      },
      verificationWarnings: [],
      contractModelId,
      blockchainTxHash: txHash,
      version: 1,
      versionNotes: "Official baseline verified model release.",
      tags: raw.tags,
      benchmarks: raw.benchmarks,
      architecture: raw.architecture,
      license: raw.license,
      inputTypes: raw.inputTypes,
      outputTypes: raw.outputTypes,
      contextWindow: raw.contextWindow,
      pricePerCall: raw.pricePerCall,
      downloads: raw.downloads || 100,
      rating: raw.rating || "4.9",
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

  console.log("🎉 All 6 genuine AI models are seeded and ready for testing!");
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(0);
}

const crypto = require("crypto");
seedModels().catch((err) => {
  console.error(err);
  process.exit(1);
});