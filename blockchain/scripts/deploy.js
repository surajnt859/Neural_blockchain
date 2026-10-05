const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEMO_BUYER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy ModelNFT (License NFT)
  const ModelNFT = await hre.ethers.getContractFactory("ModelNFT");
  const licenseNFT = await ModelNFT.deploy();
  await licenseNFT.waitForDeployment();
  const licenseAddress = await licenseNFT.getAddress();
  console.log(`✅ ModelNFT deployed to: ${licenseAddress}`);

  // 2. Deploy NeuralToken (ERC-20 Governance & Payment Token)
  const NeuralToken = await hre.ethers.getContractFactory("NeuralToken");
  const neuralToken = await NeuralToken.deploy();
  await neuralToken.waitForDeployment();
  const neuralAddress = await neuralToken.getAddress();
  console.log(`✅ NeuralToken deployed to: ${neuralAddress}`);

  // Fund demo buyer wallet with 100,000 NEURAL tokens
  try {
    const fundAmount = hre.ethers.parseUnits("100000", 18);
    const tx = await neuralToken.transfer(DEMO_BUYER_ADDRESS, fundAmount);
    await tx.wait();
    console.log(`🪙 Transferred 100,000 NEURAL tokens to demo buyer account (${DEMO_BUYER_ADDRESS})`);
  } catch (fundErr) {
    console.warn("Could not pre-fund demo account:", fundErr.message);
  }

  // 3. Deploy ModelMarketplace
  const ModelMarketplace = await hre.ethers.getContractFactory("ModelMarketplace");
  const marketplace = await ModelMarketplace.deploy(deployer.address, licenseAddress, neuralAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`✅ ModelMarketplace deployed to: ${marketplaceAddress}`);

  // Transfer NFT ownership to the marketplace contract so it can mint licenses upon purchase
  await licenseNFT.transferOwnership(marketplaceAddress);
  console.log("🔒 Transferred LicenseNFT ownership to ModelMarketplace.");

  // Build contract data object
  const artifact = await hre.artifacts.readArtifact("ModelMarketplace");
  const nftArtifact = await hre.artifacts.readArtifact("ModelNFT");
  const neuralArtifact = await hre.artifacts.readArtifact("NeuralToken");

  const contractData = {
    address: marketplaceAddress,
    abi: artifact.abi,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };
  const nftData = {
    address: licenseAddress,
    abi: nftArtifact.abi,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };
  const neuralData = {
    address: neuralAddress,
    abi: neuralArtifact.abi,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };

  // Save to frontend
  const frontendDir = path.join(__dirname, "../../frontend/src/contracts");
  fs.mkdirSync(frontendDir, { recursive: true });
  fs.writeFileSync(path.join(frontendDir, "ModelMarketplace.json"), JSON.stringify(contractData, null, 2));
  fs.writeFileSync(path.join(frontendDir, "ModelNFT.json"), JSON.stringify(nftData, null, 2));
  fs.writeFileSync(path.join(frontendDir, "NeuralToken.json"), JSON.stringify(neuralData, null, 2));

  // Save to backend
  const backendDir = path.join(__dirname, "../../backend/contracts");
  fs.mkdirSync(backendDir, { recursive: true });
  fs.writeFileSync(path.join(backendDir, "ModelMarketplace.json"), JSON.stringify(contractData, null, 2));
  fs.writeFileSync(path.join(backendDir, "ModelNFT.json"), JSON.stringify(nftData, null, 2));
  fs.writeFileSync(path.join(backendDir, "NeuralToken.json"), JSON.stringify(neuralData, null, 2));

  console.log("📄 Contract ABI + address synchronized to frontend/src/contracts/ and backend/contracts/");

  // Automatically update frontend/.env and backend/.env
  const frontendEnvPath = path.join(__dirname, "../../frontend/.env");
  if (fs.existsSync(frontendEnvPath)) {
    let envContent = fs.readFileSync(frontendEnvPath, "utf8");
    envContent = envContent.replace(/VITE_CONTRACT_ADDRESS=.*/, `VITE_CONTRACT_ADDRESS=${marketplaceAddress}`);
    envContent = envContent.replace(/VITE_NFT_CONTRACT_ADDRESS=.*/, `VITE_NFT_CONTRACT_ADDRESS=${licenseAddress}`);
    envContent = envContent.replace(/VITE_NEURAL_TOKEN_ADDRESS=.*/, `VITE_NEURAL_TOKEN_ADDRESS=${neuralAddress}`);
    fs.writeFileSync(frontendEnvPath, envContent);
    console.log("🔄 Updated frontend/.env with active contract addresses.");
  }

  const backendEnvPath = path.join(__dirname, "../../backend/.env");
  if (fs.existsSync(backendEnvPath)) {
    let bEnvContent = fs.readFileSync(backendEnvPath, "utf8");
    bEnvContent = bEnvContent.replace(/CONTRACT_ADDRESS=.*/, `CONTRACT_ADDRESS=${marketplaceAddress}`);
    bEnvContent = bEnvContent.replace(/NEURAL_TOKEN_ADDRESS=.*/, `NEURAL_TOKEN_ADDRESS=${neuralAddress}`);
    fs.writeFileSync(backendEnvPath, bEnvContent);
    console.log("🔄 Updated backend/.env with active contract addresses.");
  }

  console.log("\n🚀 Deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
