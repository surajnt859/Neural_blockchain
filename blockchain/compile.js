const hre = require("hardhat");

async function main() {
  await hre.run("compile");
  console.log("Compiled successfully!");
  
  // copy to frontend
  const fs = require('fs');
  const path = require('path');
  
  const artifactPath = path.join(__dirname, "artifacts", "contracts", "ModelMarketplace.sol", "ModelMarketplace.json");
  const destDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  
  if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
  }
  
  fs.copyFileSync(artifactPath, path.join(destDir, "ModelMarketplace.json"));
  console.log("Artifact copied to frontend!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
