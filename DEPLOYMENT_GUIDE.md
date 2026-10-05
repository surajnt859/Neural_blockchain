# NeuralChain deployment and local demonstration guide

NeuralChain is a hybrid AI-model marketplace. Smart contracts record model listings, creator addresses, payments, purchase events, and license access. Model files are stored on IPFS. The MongoDB and Express backend provides user accounts, searchable metadata, moderation, and download authorization.

This guide describes the repository's local demonstration and the configuration required to connect its services. It is not a production deployment certification.

## Implemented components

- `ModelMarketplace` records compact listing references, encrypted-content CIDs, content and key hashes, creator addresses, prices, and parent listing IDs. It settles primary-sale payments and exposes access checks.
- `ModelNFT` mints non-transferable ERC-1155 access licenses after purchases. Primary-sale payment splits are 10% platform / 90% creator without parent lineage, or 10% platform / 10% parent creator / 80% listing creator with parent lineage. There is no secondary resale market and no ERC-2981 resale royalty implementation.
- The upload API encrypts paid model files using AES-256-GCM before storing them on IPFS. It stores only a wrapped key server-side; the raw key is not returned to the browser during upload. A key is released only after a time-limited wallet signature and the contract's access check succeed.
- MongoDB and Express manage accounts, searchable metadata, moderation, purchase verification, and API requests.
- The wallet page reads MetaMask balances, chain ID, and on-chain marketplace/token events from the configured marketplace deployment block.

## Prototype and local-only components

- Hardhat Localhost is for development and demonstrations, not a production chain.
- When MongoDB or Pinata is not configured, the repository has prototype JSON persistence and local deterministic IPFS storage. These fallbacks are not durable production services.
- Governance proposals and votes are MongoDB records with token balance checks; no on-chain DAO contract or treasury exists.
- API-key/completion routes return prototype responses and do not execute uploaded model files.
- Static upload checks and duplicate-review signals do not certify model quality, provenance, or safety.

NeuralChain currently does not execute uploaded model files inside an isolated Docker sandbox. Isolated Docker inference is future scope.

## Local Hardhat demonstration

Install dependencies and compile from the repository root:

```powershell
npm run install:all
npm run build:contracts
```

Start a local Hardhat node:

```powershell
Push-Location blockchain
npx hardhat node
```

Deploy contracts to the local node in a second terminal:

```powershell
Push-Location blockchain
npx hardhat run scripts/deploy.js --network localhost
```

The deploy script writes synchronized ABI/address files to `frontend/src/contracts` and `backend/contracts`, and records the marketplace deployment block. Configure the frontend's `VITE_API_URL`, `VITE_CONTRACT_ADDRESS`, `VITE_NFT_CONTRACT_ADDRESS`, `VITE_NEURAL_TOKEN_ADDRESS`, and `VITE_DEPLOYMENT_BLOCK` from the local deployment. Configure the backend's `RPC_URL`, `MARKETPLACE_CONTRACT_ADDRESS`, and `NEURAL_TOKEN_ADDRESS`.

The deploy script funds Hardhat account #1 (the demo wallet) with 1,000 NEURAL for local demonstrations. This only runs on the local Hardhat network.

Start the API and web client in separate terminals:

```powershell
Push-Location backend
npm start
```

```powershell
Push-Location frontend
npm run dev
```

For local testing, use a Hardhat development account through MetaMask. Do not copy Hardhat keys into frontend source or `VITE_*` variables.

## Required backend configuration

Use `backend/.env.example` as the variable-name reference. Set secrets and service credentials outside source control:

- `JWT_SECRET`: a randomly generated authentication secret.
- `MODEL_ENCRYPTION_SECRET`: a base64-encoded 32-byte secret used to wrap per-upload model keys. Paid uploads fail if it is missing or invalid. Do not replace this with a hard-coded fallback.
- `MONGODB_URI`: MongoDB connection string. MongoDB is required for paid model key-envelope persistence.
- `RPC_URL` and `MARKETPLACE_CONTRACT_ADDRESS`: the RPC and marketplace deployed to the same network.
- `NEURAL_TOKEN_ADDRESS`: token contract address for token balances/purchases.
- `PINATA_JWT` or Pinata API keys: optional credentials for remote IPFS pinning. Without them, local deterministic storage is only suitable for a local demo.

Generate a key value in a trusted local shell or secret manager; do not paste it into the repository:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`frontend/.env.example` documents the public Vite values. Only public contract addresses, API URLs, and the deployment block belong in `VITE_*`; never put private keys, JWT secrets, Pinata credentials, or model-encryption secrets there.

## Operational boundaries

- The deploy script updates local ABI/address artifacts; it does not configure cloud services or make local Hardhat data persistent.
- The prototype catalog seeder creates off-chain, unverified metadata only. It does not create blockchain listings, fake transaction hashes, or funded wallets.
- Historical migration notes describe earlier project states and should not be treated as a description of current behavior.
- A production deployment requires separately designed operational controls, durable content pinning, monitored infrastructure, backups, and security review; those are not provided by this guide.
