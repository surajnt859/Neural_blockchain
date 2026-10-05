import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPlatformStats, getModels } from "../services/api";
import { soundFx } from "../services/soundFx";
import styles from "./Home.module.css";

const CORE_PILLARS = [
  {
    icon: "💎",
    title: "On-chain listings and purchases",
    desc: "Marketplace contracts record compact listing references, creator wallets, primary-sale payments, and license access.",
  },
  {
    icon: "🛡️",
    title: "Integrity checks",
    desc: "Uploads are checked and hashed before storage. Paid model files are encrypted before being sent to IPFS.",
  },
  {
    icon: "⚡",
    title: "Searchable marketplace",
    desc: "Express and MongoDB manage accounts, searchable metadata, moderation, and the application interface.",
  },
];


export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    { value: "—", label: "Contract-linked listings" },
    { value: "—", label: "Verified purchases" },
    { value: "—", label: "ETH volume" },
    { value: "—", label: "Creator primary-sale share" },
  ]);
  const [trending, setTrending] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await getPlatformStats();
        const data = statsRes.data || {};
        setStats([
          { value: Number.isFinite(data.totalModels) ? String(data.totalModels) : "—", label: "Contract-linked listings" },
          { value: Number.isFinite(data.modelsSold) ? String(data.modelsSold) : "—", label: "Verified purchases" },
          { value: Number.isFinite(data.ethRevenue) ? `${data.ethRevenue.toFixed(2)} ETH` : "—", label: "ETH volume" },
          { value: Number.isFinite(data.ethCreatorPrimarySaleShare) ? `${data.ethCreatorPrimarySaleShare.toFixed(2)} ETH` : "—", label: "Creator primary-sale share" },
        ]);
      } catch {}

      try {
        const modelsRes = await getModels({ sort: "popular", limit: 4 });
        const modelList = modelsRes.data?.models || (Array.isArray(modelsRes.data) ? modelsRes.data : []);
        setTrending(
          modelList.slice(0, 4).map((m) => ({
            ...m,
            creator: m.owner?.username || "Unknown creator",
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


  return (
    <div>
      {/* ─── Minimal Hero Section ─────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>⚡</span>
            <span>Hybrid AI-model marketplace</span>
          </div>

          <h1 className={styles.heroTitle}>
            Discover and license AI models through a <span className="gradient-text">hybrid marketplace.</span>
          </h1>

          <p className={styles.heroDesc}>
            Smart contracts record listings, creators, payments, purchase events, and license access. Model files are stored on IPFS, with accounts, metadata, and moderation provided by the backend.
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

        {/* Current architecture summary */}
        <div className={styles.heroVisual}>
          <div className={styles.terminalCard} style={{ padding: "28px" }}>
            <h2>How NeuralChain works</h2>
            <ol style={{ lineHeight: 1.9, color: "var(--text2)", paddingLeft: "22px" }}>
              <li>Express validates uploads and encrypts paid model files.</li>
              <li>IPFS stores model files; the contract records compact listing references.</li>
              <li>MongoDB and Express provide accounts, metadata search, and moderation.</li>
              <li>On-chain purchases grant wallet-bound, non-transferable license access.</li>
            </ol>
            <p style={{ color: "var(--text3)", marginTop: "16px" }}>
              Local Hardhat and JSON persistence are demo/prototype tools, not production infrastructure.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Trending Models Section ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>🔥 Trending Models</h2>
            <p className={styles.sectionDesc}>Marketplace records and their available metadata</p>
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
                  <span className={styles.metricValue}>⭐ {model.rating || "Unrated"}</span>
                </div>
                <div>
                  <span className={styles.metricLabel}>Downloads</span>
                  <span className={styles.metricValue}>{Number.isFinite(model.downloads) ? model.downloads : "Not recorded"}</span>
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
            On-chain transactions and off-chain application services work together.
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
            Upload model files, publish a listing, and receive the creator share of primary-sale payments.
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
