const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function setEnvValue(content, key, value) {
  const linePattern = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (linePattern.test(content)) return content.replace(linePattern, line);
  return `${content}${content.endsWith("\n") ? "" : "\n"}${line}\n`;
}

async function main() {
  const [deployer, demoAccount] = await hre.ethers.getSigners();
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

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    const demoAmount = hre.ethers.parseEther("1000");
    const fundingTx = await neuralToken.transfer(demoAccount.address, demoAmount);
    await fundingTx.wait();
    console.log(`Funded demo account ${demoAccount.address} with 1000 NEURAL`);
  }

  // 3. Deploy ModelMarketplace
  const ModelMarketplace = await hre.ethers.getContractFactory("ModelMarketplace");
  const marketplace = await ModelMarketplace.deploy(deployer.address, licenseAddress, neuralAddress);
  await marketplace.waitForDeployment();
  const marketplaceDeployment = await marketplace.deploymentTransaction().wait();
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
    deploymentBlock: marketplaceDeployment.blockNumber,
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
    envContent = setEnvValue(envContent, "VITE_CONTRACT_ADDRESS", marketplaceAddress);
    envContent = setEnvValue(envContent, "VITE_NFT_CONTRACT_ADDRESS", licenseAddress);
    envContent = setEnvValue(envContent, "VITE_NEURAL_TOKEN_ADDRESS", neuralAddress);
    envContent = setEnvValue(envContent, "VITE_DEPLOYMENT_BLOCK", marketplaceDeployment.blockNumber);
    fs.writeFileSync(frontendEnvPath, envContent);
    console.log("🔄 Updated frontend/.env with active contract addresses.");
  }

  const backendEnvPath = path.join(__dirname, "../../backend/.env");
  if (fs.existsSync(backendEnvPath)) {
    let bEnvContent = fs.readFileSync(backendEnvPath, "utf8");
    bEnvContent = setEnvValue(bEnvContent, "MARKETPLACE_CONTRACT_ADDRESS", marketplaceAddress);
    bEnvContent = setEnvValue(bEnvContent, "NEURAL_TOKEN_ADDRESS", neuralAddress);
    fs.writeFileSync(backendEnvPath, bEnvContent);
    console.log("🔄 Updated backend/.env with active contract addresses.");
  }

  console.log("\n🚀 Deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
