const { ethers } = require("ethers");
const artifact = require("../contracts/ModelMarketplace.json");

function getMarketplaceContract() {
    const rpcUrl = process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
    const address = process.env.MARKETPLACE_CONTRACT_ADDRESS || artifact.address;
    if (!ethers.isAddress(address)) {
        throw new Error("MARKETPLACE_CONTRACT_ADDRESS must be configured with a deployed marketplace address.");
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    return new ethers.Contract(address, artifact.abi, provider);
}

async function getOnChainModel(modelId) {
    const contract = getMarketplaceContract();
    const listing = await contract.getModel(modelId);
    return {
        id: listing[0].toString(),
        ownerWallet: listing[1],
        ipfsHash: listing[2],
        modelHash: listing[3],
        keyHash: listing[4],
        priceWei: listing[5],
        parentModelId: listing[6].toString(),
        isActive: listing[7],
        createdAt: listing[8].toString(),
    };
}

module.exports = { getMarketplaceContract, getOnChainModel };
