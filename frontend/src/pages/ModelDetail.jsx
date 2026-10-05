import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWeb3 } from "../context/Web3Context.jsx";
import CheckoutModal from "../components/CheckoutModal.jsx";
import {
  checkAccess,
  getModel,
  downloadModelBundle,
} from "../services/api";
import styles from "./ModelDetail.module.css";

const DETAIL_HIGHLIGHTS = [
  { label: "Integrity", value: "SHA-256 file hash" },
  { label: "License Access", value: "Non-transferable ERC-1155" },
  { label: "Storage Layer", value: "Paid model files encrypted before IPFS storage" },
  { label: "Primary sale", value: "Creator/platform payment split" },
];

export default function ModelDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const {
    account,
    signer,
    connectMetaMask,
  } = useWeb3();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("overview");
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  // Purchase Modal State
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  // Fetch Model Data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getModel(id);
        if (cancelled) return;
        const serverModel = res.data;

        const normalized = {
          ...serverModel,
          creator: serverModel?.owner?.username || "Unknown creator",
          isVerified: serverModel?.verificationStatus === "verified",
          image: getCategoryIcon(serverModel?.category),
          reviewCount: serverModel?.reviewCount || 0,
          rating: serverModel?.rating || "Unrated",
          downloads: serverModel?.downloads || 0,
          verificationStatus: serverModel?.verificationStatus || "unverified",
          verificationScore: serverModel?.verificationScore ?? null,
          tags: serverModel?.tags || [],
        };

        setModel(normalized);
      } catch (err) {
        if (!cancelled) setError("Model not found or server error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Check Access Status
  useEffect(() => {
    if (!model?.contractModelId) {
      setHasAccess(false);
      setHasPurchased(false);
      setIsOwner(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await checkAccess(id, account);
        if (cancelled) return;
        setHasAccess(res.data.hasAccess);
        setHasPurchased(res.data.hasPurchased);
        setIsOwner(res.data.isOwner);
      } catch (err) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [id, account, model?.contractModelId]);

  const basePriceEth = useMemo(() => {
    const n = Number(model?.price);
    return Number.isFinite(n) ? n : 0;
  }, [model?.price]);

  // Handle open purchase dialog
  const handleOpenPurchase = () => {
    setPurchaseOpen(true);
  };

  function getCategoryIcon(cat) {
    if (cat === "Audio") return "🎙️";
    if (cat === "Computer Vision") return "👁️";
    if (cat === "LLM") return "🧠";
    if (cat === "Code & Reasoning") return "💻";
    return "⚡";
  }


  if (loading) {
    return (
      <div className="container" style={{ padding: "4rem 0", textAlign: "center", color: "var(--text2)" }}>
        Loading AI model specifications...
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="container" style={{ padding: "4rem 0", textAlign: "center" }}>
        <h2>Model not found</h2>
        <p style={{ color: "var(--text2)", marginTop: "0.5rem" }}>{error || "This model is no longer available."}</p>
        <button className="btn btn-secondary" style={{ marginTop: "1rem" }} onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link to="/marketplace" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Back to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "2rem 1.5rem 6rem" }}>
      <Link to="/marketplace" className={styles.backLink}>
        ← Back to Marketplace Catalog
      </Link>

      {/* Main Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>{model.image}</div>
          <div className={styles.headerInfo}>
            <div className={styles.badges}>
              <span className="badge badge-purple">{model.category}</span>
              <span className="badge badge-green">{model.verificationStatus === "verified" ? `Static checks ${model.verificationScore ?? ""}` : model.verificationStatus}</span>
              <span className="badge badge-blue">{model.framework}</span>
            </div>
            <h1 className={styles.title}>{model.name}</h1>
            <div className={styles.creator}>
              Authored by <strong style={{ color: "#fff" }}>{model.creator}</strong> • SHA-256 integrity hash
            </div>
            <div className={styles.rating}>
              <span>⭐ {model.reviewCount ? `${model.rating} (${model.reviewCount} reviews)` : "Unrated"}</span>
              <span>📥 {model.downloads} recorded downloads</span>
              <span>Primary-sale payment split</span>
            </div>
          </div>

          {/* Pricing & License Purchase Card */}
          <div className={styles.priceActionBox}>
            {!model.contractModelId ? (
              <p style={{ color: "var(--text2)" }}>
                Prototype metadata only. This record has no on-chain listing and cannot be purchased.
              </p>
            ) : (
              <>
                <div className={styles.priceDisplay}>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text3)", fontWeight: 600 }}>
                    License Price
                  </div>
                  <div className={styles.ethPrice}>Ξ {basePriceEth} ETH</div>
                  <div className={styles.neuralPrice}>or {Math.round(basePriceEth * 1000)} NEURAL</div>
                </div>

                {hasAccess ? (
                  <div style={{ display: "grid", gap: "8px", width: "100%" }}>
                    <button onClick={() => downloadModelBundle(model.id, model.fileName || `${model.name || "model"}.model`, account, signer)} className={`btn btn-primary ${styles.buyButton}`}>
                      📥 Download and decrypt model
                    </button>
                    <div style={{ fontSize: "0.75rem", color: "var(--cyan)", textAlign: "center" }}>
                      ✓ Access verified on-chain
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "8px", width: "100%" }}>
                    <button className={`btn btn-primary ${styles.buyButton}`} onClick={handleOpenPurchase}>
                      🛒 Purchase Access License
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("testing")}>
                      View inference status
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Highlights Bar */}
      <div className={styles.highlightStrip}>
        {DETAIL_HIGHLIGHTS.map((item) => (
          <div key={item.label} className={styles.highlightCard}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          {[
            { id: "overview", label: "📋 Architecture & Specs" },
            { id: "testing", label: "Inference status" },
            { id: "metrics", label: "📊 Benchmarks" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Architecture & Specs */}
      {activeTab === "overview" && (
        <div className="grid grid-2" style={{ gap: "24px" }}>
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "16px", color: "var(--cyan)" }}>About This AI Model</h3>
            <p style={{ lineHeight: 1.7, color: "var(--text)" }}>{model.description}</p>

            <h4 style={{ marginTop: "24px", marginBottom: "12px", color: "var(--text)" }}>Tags & Capabilities</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {model.tags.map((t) => (
                <span key={t} className="badge badge-purple">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "16px", color: "var(--purple-light)" }}>Technical Specifications</h3>
            <div className={styles.specGrid}>
              <div className={styles.specItem}>
                <label>Architecture</label>
                <span>{model.architecture || "Not provided"}</span>
              </div>
              <div className={styles.specItem}>
                <label>Model Format</label>
                <span>{model.modelFormat}</span>
              </div>
              <div className={styles.specItem}>
                <label>Security Score</label>
                <span>{model.verificationScore ?? "Not available"}/100 static verification score</span>
              </div>
              <div className={styles.specItem}>
                <label>License Model</label>
                <span>Non-transferable ERC-1155 access license</span>
              </div>
              <div className={styles.specItem} style={{ gridColumn: "1 / -1" }}>
                <label>SHA-256 Integrity Hash</label>
                <code className={styles.codeSnippet}>{model.modelHash}</code>
              </div>
              <div className={styles.specItem} style={{ gridColumn: "1 / -1" }}>
                <label>IPFS CID</label>
                <code className={styles.codeSnippet}>{model.ipfsHash}</code>
              </div>
              <div className={styles.specItem}>
                <label>Contract Model ID</label>
                <span>{model.contractModelId || "Not listed"}</span>
              </div>
              <div className={styles.specItem}>
                <label>Verification State</label>
                <span>{model.verificationStatus} · {model.verificationScore ?? "Not available"} static score</span>
              </div>
              <div className={styles.specItem} style={{ gridColumn: "1 / -1" }}>
                <label>Blockchain Transaction Reference</label>
                <code className={styles.codeSnippet}>{model.blockchainTxHash || "No transaction reference recorded"}</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Interactive Playground */}
      {activeTab === "testing" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <h3 style={{ color: "var(--cyan)" }}>Inference status</h3>
          <p style={{ color: "var(--text2)", marginTop: "12px" }}>
            NeuralChain currently does not execute uploaded model files inside an isolated Docker sandbox. Isolated Docker inference is future scope.
          </p>
        </div>
      )}

      {/* Tab 3: Benchmarks */}
      {activeTab === "metrics" && (
        <div className="grid grid-2" style={{ gap: "24px" }}>
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "8px", color: "var(--cyan)" }}>Submitted benchmark metadata</h3>
            <p style={{ color: "var(--text2)", marginBottom: "12px" }}>
              Benchmark values are listing metadata and have not been independently validated.
            </p>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {model.benchmarks && Object.keys(model.benchmarks).length
                ? JSON.stringify(model.benchmarks, null, 2)
                : "No benchmark data supplied for this listing."}
            </pre>
          </div>

          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "16px", color: "var(--purple-light)" }}>Primary-sale payment allocation</h3>
            <div style={{ lineHeight: 1.6, color: "var(--text2)", fontSize: "0.95rem" }}>
              <p style={{ marginBottom: "1rem" }}>
                The contract distributes primary-sale payments to the creator and platform. Fine-tuned listings can also share a portion of a primary sale with their recorded parent creator.
                The ERC-1155 license is non-transferable; secondary resale and ERC-2981 resale royalties are not implemented.
              </p>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div>Platform primary-sale fee: <strong style={{ color: "#a78bfa" }}>10%</strong></div>
                <div>Creator share without a parent: <strong style={{ color: "#34d399" }}>90%</strong></div>
                <div>Creator share with a parent: <strong style={{ color: "#34d399" }}>80%</strong></div>
                <div>Parent share when configured: <strong style={{ color: "#38bdf8" }}>10%</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Luxury Holographic Checkout Modal */}
      <CheckoutModal
        isOpen={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        model={model}
        onPurchaseSuccess={() => {
          setHasAccess(true);
          setHasPurchased(true);
        }}
      />
    </div>
  );
}
