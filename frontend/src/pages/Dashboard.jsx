import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getDashboardData, runModelInference, downloadModelBundle, deleteModel } from "../services/api";
import { useWeb3 } from "../context/Web3Context.jsx";
import Modal from "../components/Modal.jsx";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const { account, isDemoWallet, ethBalance, neuralBalance } = useWeb3();
  const [activeTab, setActiveTab] = useState("purchased"); // default to purchased tab so user immediately sees their models!
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // License NFT Modal
  const [selectedNFTModel, setSelectedNFTModel] = useState(null);

  // Sandbox Modal for Purchased Models
  const [sandboxModel, setSandboxModel] = useState(null);
  const [sandboxPrompt, setSandboxPrompt] = useState("");
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxResult, setSandboxResult] = useState(null);

  const [dashboardData, setDashboardData] = useState({
    stats: {
      modelCount: 0,
      verifiedSales: 0,
      ethRevenue: 0,
      neuralRevenue: 0,
      creatorRoyaltyRevenue: 0,
      neuralCreatorRoyalty: 0,
      totalDownloads: 0,
      username: "Developer",
      walletAddress: null,
    },
    models: [],
    purchasedModels: [],
  });

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardData(account);
      if (res.data) {
        const { stats, myModels, purchasedModels } = res.data;
        setDashboardData({
          stats: stats || {},
          models: Array.isArray(myModels) ? myModels : [],
          purchasedModels: Array.isArray(purchasedModels) ? purchasedModels : [],
        });
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err.response?.data?.error || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [account]);

  // Handle running inference from dashboard sandbox
  const handleDashboardInference = async () => {
    if (!sandboxModel) return;
    setSandboxRunning(true);
    setSandboxResult(null);
    try {
      const res = await runModelInference(sandboxModel.id, { prompt: sandboxPrompt });
      setSandboxResult(res.data);
    } catch (err) {
      setSandboxResult({
        success: false,
        error: err.response?.data?.error || "Sandbox execution failed.",
      });
    } finally {
      setSandboxRunning(false);
    }
  };

  const handleRemoveModel = async (model) => {
    if (!window.confirm(`Remove "${model.name}" from active listings? This preserves its audit history but hides it from the marketplace.`)) return;
    try {
      await deleteModel(model.id);
      setDashboardData((current) => ({
        ...current,
        models: current.models.filter((entry) => entry.id !== model.id),
      }));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove this model.");
    }
  };

  const { stats, models, purchasedModels } = dashboardData;

  if (loading) {
    return (
      <div className="page-wrapper" style={{ paddingTop: 140, textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 20px" }}></div>
        <p style={{ color: "var(--cyan)", fontWeight: 600 }}>Loading your NeuralChain Command Center...</p>
      </div>
    );
  }

  if (error && !models.length && !purchasedModels.length) {
    return (
      <div className="page-wrapper" style={{ paddingTop: 130, textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <h2 style={{ color: "var(--text)" }}>Dashboard Connection Note</h2>
        <p style={{ color: "var(--text2)", maxWidth: "480px", margin: "10px auto 24px" }}>
          {error}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={fetchDashboard}>
            🔄 Retry Synchronization
          </button>
          <Link to="/marketplace" className="btn btn-secondary">
            🛒 Go to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ paddingTop: 90 }}>
      {/* Dashboard Top Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleArea}>
          <div className={styles.eyebrow}>
            <span>⚡</span> Web3 AI Control Center
          </div>
          <h1 className="section-title">
            Neural<span className="gradient-text">Dashboard</span>
          </h1>
          <p style={{ color: "var(--text2)", marginTop: "0.4rem" }}>
            Welcome back, <strong style={{ color: "var(--cyan)" }}>{stats.username || "Web3 Developer"}</strong> · Manage your purchased AI models, license NFTs, and creator earnings.
          </p>
        </div>

        {/* Quick Wallet Health Widget */}
        <div className={styles.walletHealthCard}>
          <div style={{ fontSize: "0.75rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Connected Account
          </div>
          <div className={styles.walletStatusPill}>
            <span className={styles.greenDot} />
            <span>{isDemoWallet ? "⚡ Demo Wallet" : account ? "🦊 MetaMask" : "⚡ Instant Demo Wallet"}</span>
            <code style={{ fontSize: "0.75rem", color: "var(--cyan)" }}>
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "0x7099...79C8"}
            </code>
          </div>
          <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem", marginTop: "4px" }}>
            <span>Ξ {ethBalance || "10.0"} ETH</span>
            <span style={{ color: "var(--purple-light)" }}>{neuralBalance || "1,000"} NEURAL</span>
          </div>
        </div>
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-4" style={{ gap: "16px", marginBottom: "2rem" }}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>🛒 Purchased Models</div>
          <div className={styles.metricValue}>{purchasedModels.length}</div>
          <div className={styles.metricSub}>Full license & weights access</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>📤 My Uploaded Models</div>
          <div className={styles.metricValue}>{models.length}</div>
          <div className={styles.metricSub}>{stats.verifiedSales || 0} total sales</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>💎 Creator Royalties</div>
          <div className={styles.metricValue} style={{ color: "var(--purple-light)" }}>
            Ξ {Number(stats.creatorRoyaltyRevenue || 0).toFixed(4)}
          </div>
          <div className={styles.metricSub}>90% automatic on-chain split</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>📥 Model Downloads</div>
          <div className={styles.metricValue}>{(stats.totalDownloads || 0).toLocaleString()}</div>
          <div className={styles.metricSub}>Across all listings</div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className={styles.tabsNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === "purchased" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("purchased")}
        >
          🛒 Purchased AI Models ({purchasedModels.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "models" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("models")}
        >
          🤖 My Uploaded Models ({models.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "earnings" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("earnings")}
        >
          💹 Sales & Analytics
        </button>
      </div>

      {/* ─── TAB 1: Purchased AI Models ────────────────────────────────────────── */}
      {activeTab === "purchased" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", color: "var(--cyan)" }}>
                📦 Your Purchased AI Models & Access Licenses
              </h2>
              <p style={{ color: "var(--text2)", fontSize: "0.9rem", marginTop: "4px" }}>
                Download production weights, run live sandbox tests, and verify cryptographic license proofs.
              </p>
            </div>
            <Link to="/marketplace" className="btn btn-secondary btn-sm">
              + Browse More Models
            </Link>
          </div>

          {purchasedModels.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text2)" }}>
              <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>🤖</div>
              <h3 style={{ color: "var(--text)" }}>No purchased models found yet</h3>
              <p style={{ maxWidth: "460px", margin: "10px auto 24px", color: "var(--text2)", fontSize: "0.95rem" }}>
                You haven't purchased any models with this account. Switch to the instant pre-funded <strong>Demo Wallet</strong> or connect <strong>MetaMask</strong> and pick a model from the marketplace!
              </p>
              <Link to="/marketplace" className="btn btn-primary">
                🛒 Explore AI Marketplace
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {purchasedModels.map((item, index) => (
                <div key={item.id + index} className={styles.purchasedModelCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span className="badge badge-purple">{item.category}</span>
                        <span className="badge badge-green">✓ License Minted</span>
                        {item.modelFormat && <span className="badge badge-outline">{item.modelFormat}</span>}
                      </div>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>{item.name}</h3>
                      <div style={{ color: "var(--text3)", fontSize: "0.85rem", marginTop: "4px" }}>
                        Created by {item.creator} · Purchased on{" "}
                        {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : "Recent"}
                      </div>
                    </div>

                    <div className={styles.priceTag}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>Paid:</div>
                      <strong style={{ color: "var(--cyan)", fontSize: "1.1rem" }}>
                        {item.paymentMethod === "NEURAL"
                          ? `${Number(item.paymentAmountDisplay || 0).toLocaleString()} NEURAL`
                          : `Ξ ${Number(item.paymentAmountDisplay || 0).toFixed(4)} ETH`}
                      </strong>
                    </div>
                  </div>

                  {/* Actions & Deliverables */}
                  <div className={styles.cardActionsRow}>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => downloadModelBundle(item.id, `${item.name || "model"}-bundle.zip`, account)}
                        className="btn btn-primary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        ⬇️ Download Model Bundle (.zip)
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSandboxModel(item);
                          setSandboxResult(null);
                          setSandboxPrompt("");
                        }}
                      >
                        ⚡ Run in Sandbox
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedNFTModel(item)}
                      >
                        📜 View License NFT
                      </button>
                    </div>

                    <Link to={`/model/${item.id}`} className="btn btn-ghost btn-sm">
                      View Model Specs →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: My Uploaded Models ─────────────────────────────────────────── */}
      {activeTab === "models" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2>🤖 Uploaded AI Models</h2>
            <Link to="/upload" className="btn btn-primary btn-sm">
              + Upload New Model
            </Link>
          </div>

          {models.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px", color: "var(--text2)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📤</div>
              <h3>No uploaded models yet</h3>
              <p style={{ marginTop: "6px", marginBottom: "20px" }}>
                Publish and monetize your trained AI models with automated 90% creator royalties.
              </p>
              <Link to="/upload" className="btn btn-primary">
                Upload First Model
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {models.map((m) => (
                <div key={m.id} style={{ background: "rgba(255, 255, 255, 0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <strong style={{ fontSize: "1.05rem" }}>{m.name}</strong>
                    <div style={{ color: "var(--text3)", fontSize: "0.85rem", marginTop: "4px" }}>
                      {m.category} · Price: Ξ {m.price} ETH · Downloads: {m.downloads || 0}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Link to={`/model/${m.id}`} className="btn btn-sm btn-secondary">
                      View
                    </Link>
                    <button onClick={() => downloadModelBundle(m.id, `${m.name || "model"}-bundle.zip`, account)} className="btn btn-sm btn-outline">
                      Download
                    </button>
                    <button onClick={() => handleRemoveModel(m)} className="btn btn-sm btn-danger" title="Remove model from active listings">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: Sales & Analytics ──────────────────────────────────────────── */}
      {activeTab === "earnings" && (
        <div className="grid grid-2" style={{ gap: "24px" }}>
          <div className="glass-card" style={{ padding: "28px" }}>
            <h3 style={{ color: "var(--cyan)", marginBottom: "16px" }}>💹 Revenue & Royalty Breakdown</h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div className={styles.analyticsRow}>
                <span>Gross ETH Volume:</span>
                <strong>Ξ {Number(stats.ethRevenue || 0).toFixed(4)}</strong>
              </div>
              <div className={styles.analyticsRow}>
                <span>Gross NEURAL Volume:</span>
                <strong style={{ color: "var(--purple-light)" }}>
                  {Number(stats.neuralRevenue || 0).toLocaleString()} NEURAL
                </strong>
              </div>
              <div className={styles.analyticsRow}>
                <span>Creator Royalties (90%):</span>
                <strong style={{ color: "var(--cyan)" }}>
                  Ξ {Number(stats.creatorRoyaltyRevenue || 0).toFixed(4)}
                </strong>
              </div>
              <div className={styles.analyticsRow}>
                <span>Platform Network Fee (10%):</span>
                <span>Ξ {Number(stats.ethPlatformShare || 0).toFixed(4)}</span>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: "28px" }}>
            <h3 style={{ color: "var(--purple-light)", marginBottom: "16px" }}>🏆 Trust & Quality Metrics</h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div className={styles.analyticsRow}>
                <span>Verified Purchases Count:</span>
                <strong>{stats.verifiedSales || 0}</strong>
              </div>
              <div className={styles.analyticsRow}>
                <span>Unique Buyer Wallets:</span>
                <strong>{stats.uniqueBuyers || 0}</strong>
              </div>
              <div className={styles.analyticsRow}>
                <span>Average Review Rating:</span>
                <strong>⭐ {stats.averageRating || "5.0"}/5</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── License NFT Proof Modal ───────────────────────────────────────────── */}
      {selectedNFTModel && (
        <Modal onClose={() => setSelectedNFTModel(null)} title="ERC-1155 License NFT Proof">
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "8px" }}>📜</div>
              <h3 style={{ color: "var(--cyan)" }}>Non-Transferable Access License</h3>
              <p style={{ color: "var(--text2)", fontSize: "0.85rem", marginTop: "4px" }}>
                Anchored to the Ethereum blockchain via ERC-1155 smart contract standards.
              </p>
            </div>

            <div style={{ background: "rgba(0, 0, 0, 0.4)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", display: "grid", gap: "10px", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text3)" }}>Model Name:</span>
                <strong>{selectedNFTModel.name}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text3)" }}>Token ID:</span>
                <strong style={{ color: "var(--purple-light)" }}>#{selectedNFTModel.nftId || "1"}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text3)", display: "block", marginBottom: "2px" }}>Transaction Hash:</span>
                <code style={{ color: "var(--cyan)", fontSize: "0.78rem", wordBreak: "break-all" }}>
                  {selectedNFTModel.transactionHash || "0xVerifiedOnChainTransactionReceipt"}
                </code>
              </div>
              <div>
                <span style={{ color: "var(--text3)", display: "block", marginBottom: "2px" }}>SHA-256 Model Hash:</span>
                <code style={{ color: "var(--text2)", fontSize: "0.78rem", wordBreak: "break-all" }}>
                  {selectedNFTModel.modelHash || "0xSHA256IntegrityHash"}
                </code>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={() => setSelectedNFTModel(null)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── In-Dashboard Sandbox Modal ────────────────────────────────────────── */}
      {sandboxModel && (
        <Modal onClose={() => setSandboxModel(null)} title={`⚡ Sandbox: ${sandboxModel.name}`}>
          <div style={{ display: "grid", gap: "16px" }}>
            <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>
              Run low-latency live test inference on your purchased model bundle.
            </p>

            <div>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "0.9rem" }}>
                Test Input Prompt:
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  className="glass-input"
                  style={{ flex: 1 }}
                  placeholder="Enter sample test input..."
                  value={sandboxPrompt}
                  onChange={(e) => setSandboxPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDashboardInference()}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleDashboardInference}
                  disabled={sandboxRunning}
                >
                  {sandboxRunning ? "Testing..." : "⚡ Execute"}
                </button>
              </div>
            </div>

            {sandboxResult && (
              <div style={{ background: "rgba(0, 0, 0, 0.5)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(0, 245, 196, 0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "0.85rem" }}>
                  <strong style={{ color: "var(--cyan)" }}>Inference Telemetry:</strong>
                  <span>Latency: <strong style={{ color: "var(--text)" }}>{sandboxResult.telemetry?.latencyMs} ms</strong></span>
                </div>
                <pre style={{ margin: 0, fontSize: "0.8rem", color: "#a7f3d0", maxHeight: "200px", overflowY: "auto" }}>
                  {JSON.stringify(sandboxResult.result || sandboxResult, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setSandboxModel(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
