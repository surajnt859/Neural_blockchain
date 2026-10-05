# NeuralChain

NeuralChain is a hybrid AI-model marketplace. Smart contracts record model listings, creator addresses, payments, purchase events, and license access. Model files are stored on IPFS. The MongoDB and Express backend provides user accounts, searchable metadata, moderation, and download authorization.

`PROJECT_ARCHITECTURE_GUIDE.html` is the current architecture source. The bundled PDF is a historical export and may not reflect the updates in the HTML guide.

## Implemented

- Solidity marketplace listings keep compact references: a model ID, IPFS CID, SHA-256 content hash, decryption-key hash, creator address, price, parent listing ID, and active state.
- The contracts settle primary sales in ETH or NEURAL and mint non-transferable ERC-1155 licenses. A primary sale allocates 10% to the platform and 90% to the creator when there is no parent listing; listings with parent lineage allocate 10% to the platform, 10% to the parent creator, and 80% to the listing creator. The checkout currently offers single-tier access; access does not expire and licenses are non-transferable. ERC-2981 resale royalties and license resale are not implemented.
- Paid model uploads are encrypted with AES-256-GCM before upload. The browser never receives the key during upload. The backend stores a wrapped key and releases it only after a wallet signature and on-chain access check. Configure `MODEL_ENCRYPTION_SECRET` as a base64-encoded 32-byte secret; there is no fallback key.
- SHA-256 remains the exact file-integrity check. Architecture fingerprints, metadata similarity, and version lineage can flag potential duplicates for moderation.
- Every model listing is saved with `pending` moderation status, regardless of client-supplied verification status. Only an administrator can approve or reject it. Static file verification is a separate check and does not itself publish a listing or validate model quality.
- The wallet page connects through MetaMask and reads actual account balances, chain ID, and contract/token events from `VITE_DEPLOYMENT_BLOCK`.
- The dashboard derives creator listings from a wallet linked through a signature and uses verified on-chain purchase records.

The backend reads authoritative listing fields from `ModelMarketplace.getModel` and joins them to MongoDB metadata by contract model ID. The reader pattern is:

```js
const { ethers } = require("ethers");
const marketplaceArtifact = require("./backend/contracts/ModelMarketplace.json");
const Model = require("./backend/models/Model");

async function readListing(rpcUrl, marketplaceAddress, modelId) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const marketplace = new ethers.Contract(marketplaceAddress, marketplaceArtifact.abi, provider);
  const listing = await marketplace.getModel(modelId);
  const metadata = await Model.findOne({ contractModelId: listing[0].toString() }).lean();

  return {
    id: listing[0].toString(),
    creator: listing[1],
    encryptedCid: listing[2],
    sha256: listing[3],
    keyHash: listing[4],
    priceWei: listing[5],
    parentModelId: listing[6].toString(),
    metadata,
  };
}
```

## Prototype/off-chain

- The governance workflow stores proposals and votes off-chain in MongoDB and checks NEURAL balances for voting power. There is no on-chain DAO voting contract or treasury.
- The API-key and completion endpoints are an off-chain prototype. They return sample responses and do not execute uploaded model files.
- MongoDB is the application data store. Local JSON persistence and deterministic local IPFS storage are development/demo fallbacks, not production data services.
- Hardhat Localhost (`chainId 31337`) is provided for local demonstrations and testing. The seeded catalog is prototype metadata and does not create on-chain listings or purchases.
- The deploy script funds Hardhat account #1 (the demo wallet) with 1,000 NEURAL for local demonstrations. This only runs on the local Hardhat network.
- Upload verification performs static checks; it does not prove model quality, safety, or benchmark performance.

## Future scope

NeuralChain currently does not execute uploaded model files inside an isolated Docker sandbox. Isolated Docker inference is future scope.

Production operations would also require managed secrets and key storage, durable IPFS pinning, monitored RPC/database services, backups, and independent security review. This repository does not claim production readiness.

## Local development

Requirements: Node.js 18+, npm, and MetaMask for wallet interactions.

Install dependencies and compile the contracts from the repository root:

```powershell
npm run install:all
npm run build:contracts
```

Start the local Hardhat node and deploy to it:

```powershell
Push-Location blockchain
npx hardhat node
```

In another terminal:

```powershell
Push-Location blockchain
npx hardhat run scripts/deploy.js --network localhost
```

The deploy script synchronizes contract ABI/address files and records the marketplace deployment block. Configure the local frontend and backend `.env` files using their `.env.example` templates. The frontend needs `VITE_API_URL`, contract addresses, and `VITE_DEPLOYMENT_BLOCK`. The backend uses `MARKETPLACE_CONTRACT_ADDRESS` with its RPC, `JWT_SECRET`, `MONGODB_URI`, and `MODEL_ENCRYPTION_SECRET` to enable paid uploads. Keep secrets in local environment configuration or a secret manager; never put private keys in `VITE_*` variables.

Run the backend and frontend:

```powershell
Push-Location backend
npm start
```

```powershell
Push-Location frontend
npm run dev
```

Use a local Hardhat account imported into MetaMask only for development. A connected wallet is required to publish or purchase an on-chain listing.

## Validation

```powershell
Push-Location blockchain; npx hardhat compile; Pop-Location
Push-Location frontend; npm run build; Pop-Location
```
