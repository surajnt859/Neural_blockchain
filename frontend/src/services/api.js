import axios from "axios";

const configuredApiUrl =
    import.meta.env.VITE_API_URL ?
    import.meta.env.VITE_API_URL.replace(/\/+$/, "") : "";
const API_BASE_URL = configuredApiUrl ?
    configuredApiUrl.endsWith("/api") ? configuredApiUrl : `${configuredApiUrl}/api` :
    "/api";
const API = axios.create({ baseURL: API_BASE_URL });

// Attach JWT token to every request automatically
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auto-cleanup stale or expired tokens without failing Web3 purchases
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            const errorMsg = String(error.response.data?.error || "").toLowerCase();
            if (
                errorMsg.includes("expired") ||
                errorMsg.includes("invalid") ||
                errorMsg.includes("token")
            ) {
                console.warn("Stale/expired JWT token detected. Cleared from storage.");
                localStorage.removeItem("token");
                localStorage.removeItem("user");
            }
        }
        return Promise.reject(error);
    }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const register = (data) => API.post("/auth/register", data);
export const login = (data) => API.post("/auth/login", data);

// ─── Models ───────────────────────────────────────────────────────────────────
export const getModels = (params) => API.get("/models", { params });
export const getModel = (id) => API.get(`/models/${id}`);
export const getModelVersions = (id) => API.get(`/models/${id}/versions`);
export const createModel = (data) => API.post("/models", data);
export const deleteModel = (id) => API.delete(`/models/${id}`);
export const createModelVersion = (id, data) => API.post(`/models/${id}/versions`, data);
export const getModelReviews = (id) => API.get(`/models/${id}/reviews`);
export const createModelReview = (id, data) => API.post(`/models/${id}/reviews`, data);
export const purchaseModel = (id, txHash, walletAddress, paymentMethod, paymentAmount, tier, parentModelId) =>
    API.post(`/models/${id}/purchase`, { txHash, walletAddress, paymentMethod, paymentAmount, tier, parentModelId });
export const checkAccess = (id, wallet) =>
    API.get(`/models/${id}/access`, { params: { wallet } });
export const compareModels = (ids) => API.get("/models/compare", { params: { ids } });
export const rateModel = (id, rating) => API.post(`/models/${id}/rate`, { rating });
export const runModelInference = (id, data) => API.post(`/models/${id}/infer`, data);
export const downloadModelBundle = async(id, filename = "model.model", wallet = null, signer = null) => {
    try {
        if (!wallet || !signer) {
            throw new Error("Connect the wallet that holds model access before downloading.");
        }
        const timestamp = Date.now();
        const message = `NeuralChain encrypted model key:${id}:${wallet.toLowerCase()}:${timestamp}`;
        const signature = await signer.signMessage(message);
        const { data: release } = await API.post(`/models/${id}/key`, { walletAddress: wallet, timestamp, signature });

        const localContentUrl = `${API_BASE_URL}/ipfs/local/${encodeURIComponent(release.cid)}`;
        let contentResponse = await fetch(localContentUrl);
        if (!contentResponse.ok) {
            const gateway = import.meta.env.VITE_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";
            contentResponse = await fetch(`${gateway.replace(/\/+$/, "")}/${encodeURIComponent(release.cid)}`);
        }
        if (!contentResponse.ok) {
            throw new Error(`Encrypted IPFS content could not be retrieved (HTTP ${contentResponse.status}).`);
        }
        const encryptedBytes = new Uint8Array(await contentResponse.arrayBuffer());
        const key = await crypto.subtle.importKey(
            "raw",
            Uint8Array.from(release.key.match(/.{2}/g), (byte) => Number.parseInt(byte, 16)),
            "AES-GCM",
            false,
            ["decrypt"]
        );
        const authTag = Uint8Array.from(release.contentAuthTag.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
        const authenticatedCiphertext = new Uint8Array(encryptedBytes.length + authTag.length);
        authenticatedCiphertext.set(encryptedBytes);
        authenticatedCiphertext.set(authTag, encryptedBytes.length);
        const plaintext = await crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: Uint8Array.from(release.contentIv.match(/.{2}/g), (byte) => Number.parseInt(byte, 16)),
            tagLength: 128,
        }, key, authenticatedCiphertext);
        const blob = new Blob([plaintext], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        return true;
    } catch (err) {
        console.error("Encrypted model download failed:", err);
        alert(err.response?.data?.error || err.message || "Failed to download encrypted model.");
        throw err;
    }
};

// ─── Governance ───────────────────────────────────────────────────────────────
export const getProposals = () => API.get("/governance/proposals");
export const createProposal = (data) => API.post("/governance/proposals", data);
export const castVote = (id, data) => API.post(`/governance/proposals/${id}/vote`, data);

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export const getModelLeaderboard = () => API.get("/leaderboard/models");
export const getCreatorLeaderboard = () => API.get("/leaderboard/creators");

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const getDashboardData = () => API.get("/dashboard");
export const getPlatformStats = () => API.get("/dashboard/platform-stats");

// ─── IPFS ─────────────────────────────────────────────────────────────────────
export const uploadToIPFS = (formData) =>
    API.post("/ipfs/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });

// ─── API Gateway & Developer Keys ─────────────────────────────────────────────
export const getApiKeys = () => API.get("/v1/keys");
export const createApiKey = (data) => API.post("/v1/keys", data);
export const deleteApiKey = (id) => API.delete(`/v1/keys/${id}`);
export const getModerationQueue = () => API.get("/admin/models");
export const moderateModel = (id, status, note) => API.patch(`/admin/models/${id}/moderation`, { status, note });
export const testApiInference = (modelId, prompt) =>
    API.post("/v1/chat/completions", {
        model: modelId,
        messages: [{ role: "user", content: prompt }],
    });

// ─── AI Bounties (Request-for-Models) ──────────────────────────────────────────
export const getBounties = (params) => API.get("/bounties", { params });
export const getBounty = (id) => API.get(`/bounties/${id}`);
export const createBounty = (data) => API.post("/bounties", data);
export const submitBountySolution = (id, data) => API.post(`/bounties/${id}/submit`, data);
export const awardBounty = (id, data) => API.post(`/bounties/${id}/award`, data);

export default API;