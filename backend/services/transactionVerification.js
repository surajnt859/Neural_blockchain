const { ethers } = require("ethers");
const marketplaceArtifact = require("../contracts/ModelMarketplace.json");
const NEURAL_PER_ETH = 1000;
const DEMO_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const isDemoMode = (wallet) => process.env.NODE_ENV !== "production" &&
    process.env.DEMO_MODE !== "false" && wallet.toLowerCase() === DEMO_WALLET.toLowerCase();

async function verifyOnChainPurchase({ txHash, model, buyerWallet, paymentMethod, tier }) {
    if (!txHash) {
        throw new Error("A valid blockchain transaction hash is required.");
    }

    const safeBuyerWallet = (buyerWallet || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8").toLowerCase();
    const licenseTier = Number(tier) === 3 ? 3 : Number(tier) === 2 ? 2 : 1;
    const tierMultiplier = licenseTier === 3 ? 10 : licenseTier === 2 ? 3 : 1;
    const basePrice = Number(model.price) || 0.012;
    const priceEth = basePrice * tierMultiplier;
    const priceNeural = Math.round(priceEth * 1000 * 0.85);
    const expectedAmount = paymentMethod === "NEURAL" ? priceNeural : priceEth;

    const rpcUrl = process.env.RPC_URL || process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";
    const marketplaceAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS || marketplaceArtifact.address;

    // 1. Try real on-chain contract verification if RPC and address are available
    if (rpcUrl && ethers.isAddress(marketplaceAddress) && /^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
            const [network, transaction, receipt] = await Promise.all([
                provider.getNetwork(),
                provider.getTransaction(txHash).catch(() => null),
                provider.getTransactionReceipt(txHash).catch(() => null),
            ]);

            if (receipt && receipt.status === 1 && transaction &&
                transaction.to && transaction.to.toLowerCase() === marketplaceAddress.toLowerCase() &&
                transaction.from && transaction.from.toLowerCase() === safeBuyerWallet) {
                const iface = new ethers.Interface(marketplaceArtifact.abi);
                const expectedEvent = paymentMethod === "NEURAL" ? "NeuralPurchase" : "ModelPurchased";
                const event = receipt.logs.map((log) => {
                    if (!log.address || log.address.toLowerCase() !== marketplaceAddress.toLowerCase()) return null;
                    try { return iface.parseLog(log); } catch { return null; }
                }).find((parsed) => parsed && parsed.name === expectedEvent);

                if (event) {
                    const eventModelId = event.args[0].toString();
                    const eventBuyer = event.args[1].toLowerCase();
                    const eventTier = paymentMethod === "NEURAL" ? event.args[3] : event.args[4];
                    const rawAmount = paymentMethod === "NEURAL" ? event.args[2] : event.args[3];
                    const expectedModelId = String(model.contractModelId || model.id);
                    const expectedRawAmount = paymentMethod === "NEURAL" ?
                        ethers.parseEther(String(basePrice)) * BigInt(tierMultiplier) * BigInt(NEURAL_PER_ETH) :
                        ethers.parseEther(String(basePrice)) * BigInt(tierMultiplier);

                    if (eventBuyer !== safeBuyerWallet || eventModelId !== expectedModelId ||
                        Number(eventTier) !== licenseTier || rawAmount !== expectedRawAmount) {
                        throw new Error("Blockchain purchase details do not match the requested model, buyer, tier, or price.");
                    }

                    return {
                        transactionHash: txHash,
                        contractModelId: eventModelId,
                        paymentAmount: Number(ethers.formatEther(rawAmount)),
                        licenseTier: Number(eventTier),
                        blockNumber: receipt.blockNumber,
                        chainId: Number(network.chainId),
                        isChainVerified: true,
                    };
                }
            }
        } catch (chainErr) {
            console.warn("Live RPC verification note:", chainErr.message);
        }
    }

    if (!isDemoMode(safeBuyerWallet)) {
        throw new Error("Blockchain transaction could not be verified. Access was not granted.");
    }

    // 2. Resilient local development / demo wallet verification fallback
    return {
        transactionHash: txHash,
        contractModelId: model.contractModelId || "1",
        paymentAmount: expectedAmount,
        licenseTier,
        blockNumber: 1,
        isChainVerified: false,
        verificationMode: "demo",
    };
}

module.exports = { verifyOnChainPurchase };