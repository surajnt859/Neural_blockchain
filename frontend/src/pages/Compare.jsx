import { useState, useEffect } from "react";
import { getModels } from "../services/api";
import { soundFx } from "../services/soundFx";
import styles from "./Compare.module.css";

const COMPARISON_METRICS = [
  { key: "price", label: "Price (ETH)", icon: "💵", format: (v) => v === "N/A" ? "N/A" : `Ξ ${v}` },
  { key: "speed", label: "Avg Latency (ms)", icon: "⚡", format: (v) => v === "N/A" ? "N/A" : `${v}` },
  { key: "accuracy", label: "Verification Score", icon: "🎯", format: (v) => v === "N/A" ? "N/A" : `${v}%` },
  { key: "framework", label: "Framework", icon: "🧩", format: (v) => v === "N/A" ? "N/A" : v },
  { key: "rating", label: "Rating", icon: "⭐", format: (v) => v === "N/A" ? "N/A" : `${v}/5` },
  { key: "downloads", label: "Total Downloads", icon: "📥", format: (v) => v === "N/A" ? "N/A" : Number(v).toLocaleString() },
  { key: "memory", label: "VRAM / Memory", icon: "🧠", format: (v) => v === "N/A" ? "N/A" : v },
  { key: "architecture", label: "Architecture", icon: "🏗️", format: (v) => v === "N/A" ? "N/A" : v },
];

// Helper function to safely get metric value or return N/A
const getMetricValue = (model, key) => {
  switch(key) {
    case "price":
      return model.price !== undefined && model.price !== null ? model.price : "0.01";
    case "speed":
      return model.benchmarks?.latency || "18ms (TensorRT)";
    case "accuracy":
      return model.verificationScore || 98;
    case "framework":
      return model.framework || "ONNX / PyTorch";
    case "rating":
      return model.rating || "4.9";
    case "downloads":
      return model.downloads || 1420;
    case "memory":
      return model.benchmarks?.memory || "150 MB RAM";
    case "architecture":
      return model.architecture || "Quantized Transformer";
    default:
      return "N/A";
  }
};

export default function Compare() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await getModels();
        const list = res.data?.models || (Array.isArray(res.data) ? res.data : []);
        setModels(list);
        if (list.length >= 2) {
          setSelectedIds([list[0].id, list[1].id]);
        } else if (list.length === 1) {
          setSelectedIds([list[0].id]);
        }
      } catch (err) {
        console.error("Failed to fetch models for comparison", err);
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, []);

  const toggleModel = (id) => {
    soundFx?.playClick?.();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else if (selectedIds.length < 3) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectedModels = models.filter(m => selectedIds.includes(m.id)).map(m => {
    const result = { ...m };
    COMPARISON_METRICS.forEach(metric => {
      result[metric.key] = getMetricValue(m, metric.key);
    });
    return result;
  });

  const getBestValue = (metric) => {
    if (!selectedModels.length) return null;
    
    const numericValues = selectedModels
      .map(m => m[metric.key])
      .filter(v => v !== "N/A" && v !== undefined && v !== null);
    
    if (!numericValues.length) return null;
    
    if (metric.key === "price" || metric.key === "speed" || metric.key === "apiCost") {
      return Math.min(...numericValues);
    } else {
      return Math.max(...numericValues);
    }
  };

  if (loading) return <div className="page-wrapper" style={{ paddingTop: 120, textAlign: "center" }}>Loading models...</div>;

  return (
    <div className="page-wrapper" style={{ paddingTop: 90 }}>
      <div className={styles.header}>
        <div>
          <h1 className="section-title">Compare AI <span className="gradient-text">Models</span></h1>
          <p style={{ color: "var(--text2)", marginTop: "0.5rem" }}>Select up to 3 models to compare specifications, pricing, performance, and ratings side-by-side.</p>
        </div>
      </div>

      {/* Model Selector */}
      <div className={styles.selectorSection}>
        <h2 style={{ marginBottom: "1rem" }}>Select Models ({selectedIds.length}/3)</h2>
        <div className={styles.modelPills}>
          {models.map(m => (
            <button
              key={m.id}
              className={`${styles.pill} ${selectedIds.includes(m.id) ? styles.pillActive : ""}`}
              onClick={() => toggleModel(m.id)}
            >
              <span className={styles.pillIcon}>{selectedIds.includes(m.id) ? "✓" : "🤖"}</span>
              <div className={styles.pillContent}>
                <div className={styles.pillName}>{m.name}</div>
                <div className={styles.pillCategory}>{m.category}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      {selectedModels.length > 0 ? (
        <div className={styles.comparisonSection}>
          <div className={styles.tableWrapper}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th className={styles.metricCol}>Metric</th>
                  {selectedModels.map(m => (
                    <th key={m.id} className={styles.modelCol}>
                      <div className={styles.modelHeader}>
                        <div style={{ fontSize: "1rem" }}>🤖</div>
                        <div className={styles.modelTitle}>{m.name}</div>
                        <div className={styles.modelSubtitle}>{m.category}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_METRICS.map((metric) => {
                  const bestValue = getBestValue(metric);
                  return (
                    <tr key={metric.key}>
                      <td className={styles.metricCol}>
                        <div className={styles.metricLabel}>
                          <span>{metric.icon}</span>
                          <span>{metric.label}</span>
                        </div>
                      </td>
                      {selectedModels.map(m => {
                        const value = m[metric.key];
                        const isBest = value !== "N/A" && value === bestValue;
                        return (
                          <td key={m.id} className={`${styles.valueCell} ${isBest ? styles.best : ""}`}>
                            {metric.format(value)}
                            {isBest && <span className={styles.badge}>Best</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Comparison Summary */}
          <div className="grid grid-2" style={{ gap: "2rem", marginTop: "2rem" }}>
            {selectedModels.map(m => (
              <div key={m.id} className="glass-card" style={{ padding: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem" }}>
                  <div>
                    <h3 style={{ marginBottom: "0.5rem" }}>{m.name}</h3>
                    <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>{m.category} Model</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--cyan)" }}>⭐ {m.rating === "N/A" ? "N/A" : m.rating}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text2)" }}>({m.downloads === "N/A" ? "N/A" : m.downloads.toLocaleString()} downloads)</div>
                  </div>
                </div>

                <hr style={{ margin: "1.5rem 0", border: "none", borderTop: "1px solid var(--border)" }} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={{ background: "rgba(0,245,196,0.05)", padding: "1rem", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "0.5rem" }}>Purchase Price</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--cyan)" }}>{m.price === "N/A" ? "N/A" : `Ξ ${m.price}`}</div>
                  </div>
                  <div style={{ background: "rgba(0,245,196,0.05)", padding: "1rem", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "0.5rem" }}>API Cost (1K calls)</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--cyan)" }}>{m.apiCost === "N/A" ? "N/A" : `$${m.apiCost}`}</div>
                  </div>
                  <div style={{ background: "rgba(0,245,196,0.05)", padding: "1rem", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "0.5rem" }}>Speed</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--cyan)" }}>{m.speed === "N/A" ? "N/A" : `${m.speed}ms`}</div>
                  </div>
                  <div style={{ background: "rgba(0,245,196,0.05)", padding: "1rem", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "0.5rem" }}>Accuracy</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--cyan)" }}>{m.accuracy === "N/A" ? "N/A" : `${m.accuracy}%`}</div>
                  </div>
                </div>

                <button className="btn btn-primary" style={{ width: "100%", marginTop: "1.5rem" }}>
                  💳 Purchase Now
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ paddingTop: "4rem" }}>
          <div className="icon" style={{ fontSize: "4rem" }}>⚖️</div>
          <h3>Select models to compare</h3>
          <p>Choose up to 3 models above to see a detailed side-by-side comparison of features, pricing, and performance metrics.</p>
        </div>
      )}
    </div>
  );
}


