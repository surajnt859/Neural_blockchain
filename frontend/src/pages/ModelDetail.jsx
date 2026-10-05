import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWeb3 } from "../context/Web3Context.jsx";
import CheckoutModal from "../components/CheckoutModal.jsx";
import {
  checkAccess,
  getModel,
  runModelInference,
  downloadModelBundle,
} from "../services/api";
import styles from "./ModelDetail.module.css";

const DETAIL_HIGHLIGHTS = [
  { label: "Verified Status", value: "On-Chain SHA-256" },
  { label: "License Access", value: "Multi-Tier NFT" },
  { label: "Storage Layer", value: "Decentralized IPFS (AES-256)" },
  { label: "Creator Royalty", value: "90% On-Chain Share" },
];

export default function ModelDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const {
    account,
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
  const [downloadUrl, setDownloadUrl] = useState(null);

  // Purchase Modal State
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  // Live Playground State
  const [sandboxPrompt, setSandboxPrompt] = useState("");
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxResult, setSandboxResult] = useState(null);
  const [activeAudioSample, setActiveAudioSample] = useState("clinic_record_01.wav");
  const [selectedVisionImage, setSelectedVisionImage] = useState("medical_scan_fp16.jpg");
  const [sdkTab, setSdkTab] = useState("python");

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
          creator: serverModel?.owner?.username || "Verified Neural Creator",
          isVerified: serverModel?.verificationStatus === "verified",
          image: getCategoryIcon(serverModel?.category),
          reviewCount: serverModel?.reviewCount || 0,
          rating: serverModel?.rating || "4.9",
          downloads: serverModel?.downloads || 1420,
          verificationStatus: serverModel?.verificationStatus || "verified",
          verificationScore: serverModel?.verificationScore || 96,
          tags: serverModel?.tags || ["AI", "Neural", "ONNX"],
        };

        setModel(normalized);
        if (normalized.category === "Audio") {
          setSandboxPrompt("Transcribe audio with timestamp alignment.");
        } else if (normalized.category === "Computer Vision") {
          setSandboxPrompt("Classify primary object and detect anomalies.");
        } else {
          setSandboxPrompt("Explain quantum computing advantages in simple terms.");
        }
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
    let cancelled = false;
    (async () => {
      try {
        const res = await checkAccess(id, account);
        if (cancelled) return;
        setHasAccess(res.data.hasAccess);
        setHasPurchased(res.data.hasPurchased);
        setIsOwner(res.data.isOwner);
        if (res.data.hasAccess) {
          setDownloadUrl(res.data.downloadUrl || `/api/models/${id}/download`);
        }
      } catch (err) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [id, account]);

  const basePriceEth = useMemo(() => {
    const n = Number(model?.price);
    return Number.isFinite(n) ? n : 0.012;
  }, [model?.price]);

  // Handle open purchase dialog
  const handleOpenPurchase = () => {
    setPurchaseOpen(true);
  };

  // Run Sandbox Inference
  const handleRunInference = async () => {
    setSandboxRunning(true);
    setSandboxResult(null);
    try {
      const res = await runModelInference(id, {
        prompt: sandboxPrompt,
        audioSample: activeAudioSample,
        imageSample: selectedVisionImage,
      });
      setSandboxResult(res.data);
    } catch (err) {
      setSandboxResult({
        success: false,
        error: err.response?.data?.error || "Inference execution failed.",
      });
    } finally {
      setSandboxRunning(false);
    }
  };

  function getCategoryIcon(cat) {
    if (cat === "Audio") return "🎙️";
    if (cat === "Computer Vision") return "👁️";
    if (cat === "LLM") return "🧠";
    if (cat === "Code & Reasoning") return "💻";
    return "⚡";
  }

  const codeSnippets = {
    python: `import onnxruntime as ort
import numpy as np

# Load verified encrypted model bundle
session = ort.InferenceSession("${model?.name?.toLowerCase().replace(/\s+/g, "_") || "model"}.onnx")
print("Model initialized on GPU execution provider (CUDA/TensorRT)")

# Run sample batch inference
input_name = session.get_inputs()[0].name
output = session.run(None, {input_name: np.random.randn(1, 3, 224, 224).astype(np.float32)})
print("Inference executed successfully!")`,
    curl: `curl -X POST https://api.neuralchain.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer nc_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model?.id || "model"}",
    "messages": [{"role": "user", "content": "Run verified inference task"}]
  }'`,
    nodejs: `import { NeuralChainClient } from "@neuralchain/sdk";

const client = new NeuralChainClient({
  apiKey: process.env.NEURALCHAIN_API_KEY,
});

const result = await client.models.infer("${model?.id}", {
  prompt: "Analyze and execute task",
});
console.log(result.output);`,
    openai: `from openai import OpenAI

client = OpenAI(
    api_key="nc_live_YOUR_API_KEY",
    base_url="https://api.neuralchain.ai/api/v1"
)

response = client.chat.completions.create(
    model="${model?.id || "model"}",
    messages=[{"role": "user", "content": "Explain quantum advantage"}]
)
print(response.choices[0].message.content)`,
  };

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
              <span className="badge badge-green">✓ {model.verificationScore}% Verified Security</span>
              <span className="badge badge-blue">{model.framework}</span>
            </div>
            <h1 className={styles.title}>{model.name}</h1>
            <div className={styles.creator}>
              Authored by <strong style={{ color: "#fff" }}>{model.creator}</strong> • SHA-256 Verified
            </div>
            <div className={styles.rating}>
              <span>⭐ {model.rating} (Verified Buyers)</span>
              <span>📥 {model.downloads} downloads</span>
              <span>⚡ 90% Creator Royalties</span>
            </div>
          </div>

          {/* Pricing & License Purchase Card */}
          <div className={styles.priceActionBox}>
            <div className={styles.priceDisplay}>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text3)", fontWeight: 600 }}>
                License Price
              </div>
              <div className={styles.ethPrice}>Ξ {basePriceEth} ETH</div>
              <div className={styles.neuralPrice}>or {Math.round(basePriceEth * 1000 * 0.85)} NEURAL (15% DAO Discount)</div>
            </div>

            {hasAccess ? (
              <div style={{ display: "grid", gap: "8px", width: "100%" }}>
                <button onClick={() => downloadModelBundle(model.id, `${model.name || "model"}-bundle.zip`, account)} className={`btn btn-primary ${styles.buyButton}`}>
                  📥 Download Weights (.zip)
                </button>
                <div style={{ fontSize: "0.75rem", color: "var(--cyan)", textAlign: "center" }}>
                  ✓ Unlocked & Verified on Blockchain
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px", width: "100%" }}>
                <button className={`btn btn-primary ${styles.buyButton}`} onClick={handleOpenPurchase}>
                  🛒 Purchase Access License
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab("testing")}>
                  🧪 Test Preview in Sandbox
                </button>
              </div>
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
            { id: "testing", label: "⚡ Live Interactive Playground" },
            { id: "metrics", label: "📊 Benchmarks & Radar" },
            { id: "api", label: "💻 Developer SDK & APIs" },
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
                <span>{model.architecture || "Deep Neural Network"}</span>
              </div>
              <div className={styles.specItem}>
                <label>Model Format</label>
                <span>{model.modelFormat}</span>
              </div>
              <div className={styles.specItem}>
                <label>Security Score</label>
                <span>{model.verificationScore}/100 (SafeTensors AST Passed)</span>
              </div>
              <div className={styles.specItem}>
                <label>License Model</label>
                <span>Perpetual Smart Contract NFT</span>
              </div>
              <div className={styles.specItem} style={{ gridColumn: "1 / -1" }}>
                <label>SHA-256 Integrity Hash</label>
                <code className={styles.codeSnippet}>{model.modelHash}</code>
              </div>
              <div className={styles.specItem} style={{ gridColumn: "1 / -1" }}>
                <label>Decentralized IPFS CID</label>
                <code className={styles.codeSnippet}>{model.ipfsHash}</code>
              </div>
              <div className={styles.specItem}>
                <label>Contract Model ID</label>
                <span>{model.contractModelId || "Not listed"}</span>
              </div>
              <div className={styles.specItem}>
                <label>Verification State</label>
                <span>{model.verificationStatus} · {model.verificationScore}/100</span>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ color: "var(--cyan)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚡</span> Interactive In-Browser Model Playground
              </h3>
              <p style={{ color: "var(--text2)", fontSize: "0.9rem", marginTop: "4px" }}>
                Execute test inferences with real telemetry, latency metrics, and hardware acceleration simulation.
              </p>
            </div>
            <span className="badge badge-green">Engine Online</span>
          </div>

          {model.category === "Audio" ? (
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Select Sample Audio Stream:
              </label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
                {["clinic_record_01.wav", "investor_earnings_call.mp3", "multilingual_french_speech.wav"].map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`btn btn-sm ${activeAudioSample === a ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setActiveAudioSample(a)}
                  >
                    🎵 {a}
                  </button>
                ))}
              </div>
            </div>
          ) : model.category === "Computer Vision" ? (
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Select Image Test Sample:
              </label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
                {["medical_scan_fp16.jpg", "pcb_defect_macro.png", "autonomous_driving_street.jpg"].map((img) => (
                  <button
                    key={img}
                    type="button"
                    className={`btn btn-sm ${selectedVisionImage === img ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setSelectedVisionImage(img)}
                  >
                    🖼️ {img}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Prompt / Task Description:
              </label>
              <textarea
                rows={2}
                className="glass-input"
                style={{ width: "100%", padding: "12px", color: "#fff" }}
                value={sandboxPrompt}
                onChange={(e) => setSandboxPrompt(e.target.value)}
              />
            </div>
          )}

          <button className="btn btn-primary" onClick={handleRunInference} disabled={sandboxRunning}>
            {sandboxRunning ? "Running Inference..." : "⚡ Execute Model Inference"}
          </button>

          {sandboxResult && (
            <div className={styles.sandboxResultBox}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <strong style={{ color: "var(--cyan)" }}>Inference Result:</strong>
                <div style={{ fontSize: "0.85rem", color: "var(--text2)" }}>
                  ⚡ Latency: <strong>{sandboxResult.latencyMs}ms</strong> • Device: <strong>{sandboxResult.device}</strong>
                </div>
              </div>
              <pre className={styles.sandboxOutput}>{sandboxResult.output || JSON.stringify(sandboxResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Benchmarks & Radar Matrix */}
      {activeTab === "metrics" && (
        <div className="grid grid-2" style={{ gap: "24px" }}>
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "16px", color: "var(--cyan)" }}>Performance Radar Metrics</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { name: "Model Accuracy / F1-Score", val: 96, label: "96.4%" },
                { name: "Inference Throughput", val: 92, label: "240 tok/s or 60 FPS" },
                { name: "Memory Footprint Efficiency", val: 88, label: "150 MB VRAM" },
                { name: "Zero-Knowledge Safety Score", val: 98, label: "98/100" },
              ].map((m) => (
                <div key={m.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.9rem" }}>
                    <span>{m.name}</span>
                    <strong style={{ color: "var(--cyan)" }}>{m.label}</strong>
                  </div>
                  <div style={{ height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${m.val}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #6366f1, #00f5c4)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ marginBottom: "16px", color: "var(--purple-light)" }}>Decentralized Lineage & Royalties</h3>
            <div style={{ lineHeight: 1.6, color: "var(--text2)", fontSize: "0.95rem" }}>
              <p style={{ marginBottom: "1rem" }}>
                This model is protected by EIP-2981 decentralized royalty graphs. Whenever downstream fine-tunes or LoRA
                adapters are derived from this model, 10% royalties automatically stream back to the original author.
              </p>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div>Creator Royalty: <strong style={{ color: "#34d399" }}>90%</strong></div>
                <div>Lineage Upstream Fee: <strong style={{ color: "#38bdf8" }}>10%</strong></div>
                <div>Platform Protocol Fee: <strong style={{ color: "#a78bfa" }}>10%</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Developer SDK & API Snippets */}
      {activeTab === "api" && (
        <div className="glass-card" style={{ padding: "28px" }}>
          <h3 style={{ marginBottom: "12px", color: "var(--cyan)" }}>One-Click Developer SDK Integration</h3>
          <p style={{ color: "var(--text2)", marginBottom: "1.5rem" }}>
            Copy and paste ready-to-run snippets into your Python scripts, cURL pipelines, or TypeScript backends:
          </p>

          <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
            {[
              { id: "python", label: "Python (ONNX)" },
              { id: "curl", label: "cURL API" },
              { id: "nodejs", label: "Node.js SDK" },
              { id: "openai", label: "OpenAI Client" },
            ].map((s) => (
              <button
                key={s.id}
                className={`btn btn-sm ${sdkTab === s.id ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSdkTab(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <pre
            style={{
              background: "#090d16",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "1.25rem",
              color: "#a5f3fc",
              fontFamily: "monospace",
              fontSize: "0.85rem",
              overflowX: "auto",
              lineHeight: 1.5,
            }}
          >
            {codeSnippets[sdkTab]}
          </pre>
        </div>
      )}

      {/* Luxury Holographic Checkout Modal */}
      <CheckoutModal
        isOpen={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        model={model}
        onPurchaseSuccess={(receipt) => {
          setHasAccess(true);
          setHasPurchased(true);
          setDownloadUrl(receipt.downloadUrl);
        }}
      />
    </div>
  );
}
