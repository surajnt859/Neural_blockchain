# NeuralChain Cloud & Production Deployment Guide

This guide covers all options for deploying NeuralChain AI Model Marketplace to the cloud or running as a production container.

---

## 🌟 Architecture Overview

NeuralChain is built as a production-grade full-stack Web3 application:
* **Frontend**: React + Vite + Ethers.js
* **Backend**: Node.js / Express + MongoDB Atlas + JWT Auth
* **Smart Contracts**: Solidity 0.8.24 (Marketplace, License NFT, ERC-20 NEURAL Token)
* **Unified Production Serving**: In production, the Express backend serves both the `/api/*` REST endpoints and the compiled React SPA static bundle (`frontend/dist`), allowing deployment as a single lightweight cloud web service.

---

## 🚂 Option 1: Deploy to Railway.app (1-Click Automatic)

Railway automatically detects [railway.json](file:///c:/Users/yuvan/OneDrive/Desktop/2026%20project/forournewproject/forournewproject/railway.json) and [Dockerfile](file:///c:/Users/yuvan/OneDrive/Desktop/2026%20project/forournewproject/forournewproject/Dockerfile):

### Steps to Deploy:
1. Go to **[Railway.app](https://railway.com)** and sign in with GitHub.
2. Click **New Project > Deploy from GitHub repo**.
3. Select your repository: **`Yuva48/NeuralChain`**.
4. Railway will automatically start building the container image.
5. In the Railway dashboard for your service, go to the **Variables** tab and add:
   * `NODE_ENV`: `production`
   * `JWT_SECRET`: generate a unique random value of at least 32 characters
   * `MONGODB_URI`: your private MongoDB connection string
   * `RPC_URL`: the RPC endpoint for the deployed marketplace chain
   * `MARKETPLACE_CONTRACT_ADDRESS`: the deployed marketplace address
   * `ADMIN_EMAIL` and `ADMIN_PASSWORD`: deployment-managed admin bootstrap credentials
   * `CONTRACT_ADDRESS`: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
   * `NEURAL_TOKEN_ADDRESS`: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
   * `PINATA_JWT`: *(optional for IPFS)*
6. In the **Settings** tab:
   * Under **Networking**, click **Generate Domain** (e.g. `neuralchain-production.up.railway.app`).
7. Your full website (Frontend + Backend + DB) is now live on your custom Railway domain!

---

## 🚀 Option 2: Deploy to Render.com (Free Web Service)

Render natively supports both Web Services and Docker:

### Method A: Connect Git Repo (Single Web Service)
1. Push your code to GitHub / GitLab.
2. Go to [Render Dashboard](https://dashboard.render.com) and click **New + > Web Service**.
3. Select your repository.
4. Set the following build settings:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: *(your secret key or generate random)*
   - `MONGODB_URI`: *(your MongoDB Atlas URI)*
   - `CONTRACT_ADDRESS`: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` (or your testnet address)
   - `NEURAL_TOKEN_ADDRESS`: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` (or your testnet address)
   - `PINATA_JWT`: *(optional for IPFS storage)*
6. Click **Deploy Web Service**.

### Method B: Blueprint (1-Click Deploy)
Render will automatically detect [render.yaml](file:///c:/Users/yuvan/OneDrive/Desktop/2026%20project/forournewproject/forournewproject/render.yaml). Simply create a **Blueprint** in Render and link this repository.

---

## 🐳 Option 2: Docker / Docker Compose

### Run with Docker Compose:
```bash
docker compose up --build -d
```
The application will be live at `http://localhost:5000`.

### Build & Run Docker Image Manually:
```bash
docker build -t neuralchain-marketplace .
docker run -p 5000:5000 --env-file backend/.env neuralchain-marketplace
```

---

## ☁️ Option 3: Deploy to Railway / Fly.io / GCP Cloud Run

Because a multi-stage [Dockerfile](file:///c:/Users/yuvan/OneDrive/Desktop/2026%20project/forournewproject/forournewproject/Dockerfile) is included:
* **Railway**: Connect your repository and Railway will auto-detect Dockerfile and deploy.
* **Fly.io**: Run `fly launch` in this directory.
* **Google Cloud Run**: Run `gcloud run deploy --source .`

---

## ▲ Option 4: Split Deployment (Vercel Frontend + Render Backend)

If you prefer hosting the React frontend on Vercel:
1. Import the project into Vercel.
2. Set **Root Directory** to `frontend`.
3. Set the environment variable:
   - `VITE_API_URL`: `https://your-backend-app.onrender.com`
   - `VITE_CONTRACT_ADDRESS`: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
   - `VITE_NFT_CONTRACT_ADDRESS`: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
   - `VITE_NEURAL_TOKEN_ADDRESS`: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
4. Deploy the backend to Render/Railway as described in Option 1.
