const { ethers } = require("ethers");
const marketplaceArtifact = require("../contracts/ModelMarketplace.json");
const { getOnChainModel, getMarketplaceContract } = require("./marketplaceReader");

const TIER_MULTIPLIERS = { 1: 1n, 2: 3n, 3: 10n };
const NEURAL_PER_ETH = 1000n;

async function verifyOnChainPurchase({ txHash, model, buyerWallet, paymentMethod, tier }) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(String(txHash || ""))) {
        throw new Error("A valid blockchain transaction hash is required.");
    }
    if (!ethers.isAddress(buyerWallet)) {
        throw new Error("A valid buyer wallet address is required.");
    }
    if (!["ETH", "NEURAL"].includes(paymentMethod)) {
        throw new Error("Only on-chain ETH and NEURAL payments are supported.");
    }
    const licenseTier = Number(tier);
    if (!TIER_MULTIPLIERS[licenseTier]) throw new Error("Invalid license tier.");

    const marketplaceAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS || marketplaceArtifact.address;
    if (!ethers.isAddress(marketplaceAddress)) {
        throw new Error("MARKETPLACE_CONTRACT_ADDRESS must identify the deployed marketplace.");
    }
    const contract = getMarketplaceContract();
    const provider = contract.runner;
    const [network, transaction, receipt, listing] = await Promise.all([
        provider.getNetwork(),
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash),
        getOnChainModel(model.contractModelId),
    ]);

    if (!transaction || !receipt || receipt.status !== 1) {
        throw new Error("The purchase transaction is missing or was not confirmed successfully.");
    }
    if (!transaction.to || transaction.to.toLowerCase() !== marketplaceAddress.toLowerCase()) {
        throw new Error("Transaction was not sent to the configured marketplace contract.");
    }
    if (transaction.from.toLowerCase() !== buyerWallet.toLowerCase()) {
        throw new Error("Transaction sender does not match the buyer wallet.");
    }
    if (!listing.isActive) throw new Error("The on-chain model listing is inactive.");
    if (listing.ipfsHash !== model.ipfsHash ||
        listing.ownerWallet.toLowerCase() !== String(model.ownerWallet || "").toLowerCase() ||
        listing.modelHash.toLowerCase() !== `0x${String(model.modelHash || "").replace(/^0x/, "")}`.toLowerCase()) {
        throw new Error("MongoDB model metadata does not match the authoritative on-chain listing.");
    }

    const expectedModelId = String(model.contractModelId);
    const expectedAmount = BigInt(listing.priceWei) * TIER_MULTIPLIERS[licenseTier] *
        (paymentMethod === "NEURAL" ? NEURAL_PER_ETH : 1n);
    const expectedEventName = paymentMethod === "NEURAL" ? "NeuralPurchase" : "ModelPurchased";
    const iface = new ethers.Interface(marketplaceArtifact.abi);
    const parsedEvent = receipt.logs
        .filter((log) => log.address.toLowerCase() === marketplaceAddress.toLowerCase())
        .map((log) => {
            try { return iface.parseLog(log); } catch { return null; }
        })
        .find((event) => event?.name === expectedEventName);

    if (!parsedEvent) throw new Error(`Transaction did not emit a ${expectedEventName} event.`);
    const eventModelId = String(paymentMethod === "NEURAL" ? parsedEvent.args.modelId : parsedEvent.args.id);
    const eventBuyer = parsedEvent.args.buyer.toLowerCase();
    const amount = paymentMethod === "NEURAL" ? parsedEvent.args.tokenAmount : parsedEvent.args.price;
    const eventTier = Number(parsedEvent.args.tier);
    if (eventModelId !== expectedModelId ||
        eventBuyer !== buyerWallet.toLowerCase() ||
        eventTier !== licenseTier ||
        amount !== expectedAmount) {
        throw new Error("On-chain purchase model, buyer, license tier, or payment amount does not match.");
    }

    return {
        transactionHash: txHash,
        contractModelId: eventModelId,
        paymentAmount: Number(ethers.formatEther(amount)),
        licenseTier,
        blockNumber: receipt.blockNumber,
        chainId: Number(network.chainId),
        isChainVerified: true,
    };
}

module.exports = { verifyOnChainPurchase };
