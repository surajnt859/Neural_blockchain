# NeuralChain AI Model Marketplace

A prototype AI model marketplace with model verification, IPFS storage, blockchain listings, verified purchases, license NFTs, NEURAL payments, reviews, versioning, reputation, and token-based governance.

## Requirements

- Node.js 18+
- MetaMask configured for Hardhat Localhost (`http://127.0.0.1:8545`, chain ID `31337`)

## Quick start

From the repository root, install and prepare everything with:

```powershell
npm run install:all
npm run build:contracts
```

Then run the local blockchain, deploy the contracts, start the backend, and launch the frontend:

```powershell
# Terminal 1
npm run dev:blockchain

# Terminal 2
npm run deploy:local

# Terminal 3
npm run dev:backend

# Terminal 4
npm run dev:frontend
```

## Clean local start

Open three terminals from the repository root:

```powershell
Push-Location blockchain
npm install
npx hardhat compile
npx hardhat node
```

In a second terminal, deploy the contracts while the node is running:

```powershell
Push-Location blockchain
npx hardhat run scripts/deploy.js --network localhost
```

The deployment script writes synchronized ABI/address files to `frontend/src/contracts` and `backend/contracts`. Copy the printed marketplace, NFT, and NEURAL addresses into `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_CONTRACT_ADDRESS=<marketplace-address>
VITE_NFT_CONTRACT_ADDRESS=<model-nft-address>
VITE_NEURAL_TOKEN_ADDRESS=<neural-token-address>
```

Start the API in a third terminal:

```powershell
Push-Location backend
npm install
npm start
```

Start the frontend from another terminal:

```powershell
Push-Location frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal. Import a Hardhat test account into MetaMask for local testing. The frontend upload flow requires a connected wallet and a successful blockchain listing.

## Demo flow

1. Register/login, connect MetaMask, and upload a supported model file.
2. Static security checks run before IPFS; new records remain `pending` until an admin reviews them.
3. The listing is recorded on-chain as pending and receives a contract model ID.
4. An admin logs in through the normal login page and reviews `/admin`; only approved models become public.
5. Buyers purchase with ETH or NEURAL. The backend verifies the mined receipt, contract address, sender, model ID, event, and tier before granting access.
5. A purchase mints a non-transferable license NFT and splits payment 10% to the creator and 90% to the platform.
6. Verified buyers can submit one review per model.
7. Model owners can publish versions from the model detail page.
8. NEURAL holders can vote; 100 NEURAL is required to create a proposal and 1 NEURAL is required to vote. Governance requests use MetaMask signatures.

## Configuration and limitations

- `blockchain/.env.example` documents optional Sepolia deployment variables. Never commit private keys or real RPC credentials.
- JSON files in `backend/data` are prototype storage and are not suitable for concurrent production writes.
- IPFS requires an authenticated upload and uses Pinata when `PINATA_JWT` is configured; deterministic local CIDs are not durable storage.
- Runtime model inference is not executed by the verifier. Uploaded files are inspected without importing or executing arbitrary code; production deployments should add an isolated runner with no network, read-only storage, and CPU, memory, and time limits before claiming benchmark validation.
- Create an admin with deployment-managed secrets: `Push-Location backend; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="a-long-secret-password"; npm run admin:create; Pop-Location`.
- Configure `JWT_SECRET`, `MONGODB_URI`, `RPC_URL`, and `MARKETPLACE_CONTRACT_ADDRESS` through the deployment secret manager. Do not commit real values.
- Existing seeded models may be legacy records without blockchain IDs and cannot accept verified purchases until listed on-chain.
- Hardhat artifacts and cache are generated build output; regenerate them with Hardhat rather than editing them manually.

## Validation

```powershell
Push-Location blockchain; npx hardhat compile; Pop-Location
Push-Location frontend; npm run build; Pop-Location
```
