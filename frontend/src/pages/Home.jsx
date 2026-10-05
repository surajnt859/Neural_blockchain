import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPlatformStats, getModels } from "../services/api";
import { soundFx } from "../services/soundFx";
import styles from "./Home.module.css";

const CORE_PILLARS = [
  {
    icon: "💎",
    title: "90% Creator Royalties",
    desc: "Smart contracts route 90% of every model sale and downstream fine-tune directly to creator wallets.",
  },
  {
    icon: "🛡️",
    title: "Cryptographic Attestation",
    desc: "Every weight artifact is SHA-256 verified, malware-screened, and pinned to decentralized IPFS storage.",
  },
  {
    icon: "⚡",
    title: "OpenAI-Compatible Gateway",
    desc: "Query on-chain models via standard OpenAI REST APIs (`nc_live_...`) with instant streaming inference.",
  },
];

const TERMINAL_DEMOS = [
  {
    id: "whisper",
    title: "whisper-v3.onnx",
    prompt: "$ neuralchain run audio/transcribe --model whisper-v3",
    output: `⚡ Model Loaded: Whisper-Large-v3 (FP16 ONNX)
⏳ GPU Latency: 42ms (NVIDIA TensorRT)
📝 Transcription: "Decentralized AI with 90% creator economics."
✨ Accuracy Score: 99.4% · WER: 0.012`,
    latency: "42ms",
    size: "1.42 GB",
  },
  {
    id: "llama",
    title: "llama-3-8b.gguf",
    prompt: '$ curl https://api.neuralchain.ai/v1/chat/completions -H "Authorization: Bearer nc_live_..."',
    output: `HTTP/1.1 200 OK (streaming tokens)
"On-chain model verification ensures verifiable weight integrity and trustless provenance."
⚡ Speed: 114.2 t/s · VRAM: 4.8 GB`,
    latency: "18ms TTFT",
    size: "4.8 GB",
  },
  {
    id: "resnet",
    title: "resnet50.pt",
    prompt: "$ neuralchain verify --cid bafybeic... --hash e3b0c442...",
    output: `🛡️ SHA-256: MATCH (e3b0c44298fc1c14...)
🔍 Malicious Opcodes: 0 Detected
📦 IPFS CID: bafybeicg5q4...
✅ Status: Verified Commercial Grade`,
    latency: "12ms",
    size: "98 MB",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    { value: "14", label: "Verified Models" },
    { value: "1,280+", label: "Verified Sales" },
    { value: "90%", label: "Creator Royalty" },
    { value: "48.5 ETH", label: "Total Volume" },
  ]);
  const [trending, setTrending] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await getPlatformStats();
        const data = statsRes.data || {};
        const totalModels = data.totalModels ?? 14;
        const modelsSold = data.modelsSold ?? 1280;
        const ethVolume = typeof data.ethRevenue === "number" ? `${data.ethRevenue.toFixed(2)} ETH` : "48.5 ETH";

        setStats([
          { value: totalModels.toString(), label: "Verified Models" },
          { value: modelsSold.toString(), label: "Verified Sales" },
          { value: "90%", label: "Creator Royalty" },
          { value: ethVolume, label: "Total Volume" },
        ]);
      } catch {}

      try {
        const modelsRes = await getModels({ sort: "popular", limit: 4 });
        const modelList = modelsRes.data?.models || (Array.isArray(modelsRes.data) ? modelsRes.data : []);
        setTrending(
          modelList.slice(0, 4).map((m) => ({
            ...m,
            creator: m.owner?.username || "Architect",
            image: m.category === "Audio" ? "🎙️" : m.category === "Computer Vision" ? "👁️" : m.category === "NLP" ? "🧠" : "🤖",
          }))
        );
      } catch {}
    };

    fetchData();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    soundFx.playClick();
    if (searchQuery.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate("/marketplace");
    }
  };

  const currentDemo = TERMINAL_DEMOS[activeTab];

  return (
    <div>
      {/* ─── Minimal Hero Section ─────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>⚡</span>
            <span>Decentralized AI Marketplace</span>
          </div>

          <h1 className={styles.heroTitle}>
            Trade and deploy AI models with <span className="gradient-text">90% creator royalties.</span>
          </h1>

          <p className={styles.heroDesc}>
            Discover verified open-source weights, query models via OpenAI-compatible endpoints, and earn on-chain royalties for your architectures.
          </p>

          {/* Quick Search */}
          <form className={styles.heroSearch} onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search Whisper, Llama 3, Stable Diffusion, PyTorch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" onClick={() => soundFx.playClick()}>
              Search ↵
            </button>
          </form>

          {/* Clean Primary Actions */}
          <div className={styles.heroCtas}>
            <Link to="/marketplace" className="btn btn-primary btn-lg" onClick={() => soundFx.playClick()}>
              🛒 Explore Models
            </Link>
            <Link to="/upload" className="btn btn-secondary btn-lg" onClick={() => soundFx.playClick()}>
              ⬆️ Publish Model
            </Link>
          </div>

          {/* Key Metrics */}
          <div className={styles.stats}>
            {stats.map(({ value, label }) => (
              <div key={label} className={styles.stat}>
                <span className={styles.statValue}>{value}</span>
                <span className={styles.statLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Interactive Terminal Visual */}
        <div className={styles.heroVisual}>
          <div className={styles.terminalCard}>
            <div className={styles.terminalHeader}>
              <div className={styles.terminalDots}>
                <span className={`${styles.terminalDot} ${styles.dotRed}`} />
                <span className={`${styles.terminalDot} ${styles.dotYellow}`} />
                <span className={`${styles.terminalDot} ${styles.dotGreen}`} />
              </div>
              <span className={styles.terminalTitle}>neuralchain-runtime</span>
              <div className={styles.terminalLiveBadge}>
                <span className={styles.liveDot} />
                <span>ONLINE</span>
              </div>
            </div>

            <div className={styles.terminalTabs}>
              {TERMINAL_DEMOS.map((demo, idx) => (
                <button
                  key={demo.id}
                  className={`${styles.terminalTab} ${idx === activeTab ? styles.terminalTabActive : ""}`}
                  onClick={() => {
                    soundFx.playClick();
                    setActiveTab(idx);
                  }}
                >
                  {demo.title}
                </button>
              ))}
            </div>

            <div className={styles.terminalBody}>
              <div className={styles.terminalPrompt}>{currentDemo.prompt}</div>
              <div className={styles.terminalOutput}>{currentDemo.output}</div>
            </div>

            <div className={styles.terminalFooter}>
              <span>⚡ {currentDemo.latency}</span>
              <span>📦 {currentDemo.size}</span>
              <span style={{ color: "#34d399", fontWeight: 700 }}>90% Creator Share</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Trending Models Section ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>🔥 Trending Models</h2>
            <p className={styles.sectionDesc}>Top-downloaded models with verified SHA-256 provenance</p>
          </div>
          <Link to="/marketplace" className="btn btn-secondary btn-sm" onClick={() => soundFx.playClick()}>
            View All →
          </Link>
        </div>

        <div className="grid grid-4">
          {trending.map((model) => (
            <Link
              key={model._id || model.id}
              to={`/model/${model._id || model.id}`}
              className={styles.modelCard}
              onClick={() => soundFx.playClick()}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>{model.image}</div>
                <span className={styles.cardCategory}>{model.category}</span>
              </div>
              <h3 className={styles.cardTitle}>{model.name}</h3>
              <p className={styles.cardCreator}>by {model.creator}</p>
              <div className={styles.cardMetrics}>
                <div>
                  <span className={styles.metricLabel}>Rating</span>
                  <span className={styles.metricValue}>⭐ {model.rating || 4.9}</span>
                </div>
                <div>
                  <span className={styles.metricLabel}>Downloads</span>
                  <span className={styles.metricValue}>{model.downloads || 42}</span>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span className={styles.price}>{model.price ? `Ξ ${model.price}` : "Free"}</span>
                <span className="btn btn-sm btn-primary">Inspect ⚡</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── 3 Core Pillars ─────────────────────────────────────────────────── */}
      <section className={styles.section} style={{ background: "rgba(9, 14, 24, 0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h2 className={styles.sectionTitle}>Why NeuralChain?</h2>
          <p className={styles.sectionDesc} style={{ maxWidth: 500, margin: "4px auto 0" }}>
            Decentralized infrastructure built for creators and developers.
          </p>
        </div>

        <div className="grid grid-3">
          {CORE_PILLARS.map(({ icon, title, desc }) => (
            <div key={title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{icon}</div>
              <h3 className={styles.featureTitle}>{title}</h3>
              <p className={styles.featureDesc}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Minimal CTA Banner ──────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem", color: "#fff" }}>
            Ready to monetize your models?
          </h2>
          <p style={{ color: "#94a3b8", maxWidth: 520, margin: "0 auto", fontSize: "1rem" }}>
            Upload your weights to IPFS, set your license price, and start earning 90% royalties.
          </p>
          <div className={styles.ctaButtons}>
            <Link to="/upload" className="btn btn-primary btn-lg" onClick={() => soundFx.playClick()}>
              🚀 Launch in Studio
            </Link>
            <Link to="/developers" className="btn btn-secondary btn-lg" onClick={() => soundFx.playClick()}>
              ⚡ Developer API
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
