import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getModels } from "../services/api";
import ModelCard from "../components/ModelCard.jsx";
import SkeletonCard from "../components/SkeletonCard.jsx";
import { soundFx } from "../services/soundFx";
import styles from "./Marketplace.module.css";

const CATEGORIES = ["All", "Computer Vision", "NLP", "Generative AI", "Finance", "Audio", "General"];
const FRAMEWORKS = ["All", "PyTorch", "ONNX", "GGUF", "SafeTensors", "TensorFlow"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "popular", label: "Most Popular" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "rating", label: "Best Rated" },
];

const MARKETPLACE_HIGHLIGHTS = [
  { label: "Verified Models", value: "14 Assets" },
  { label: "Creator Royalty", value: "90% Payout" },
  { label: "Payment Rails", value: "ETH + NEURAL" },
  { label: "Attestation", value: "SHA-256 IPFS" },
];

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const initialSearch = searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "All";

  const [search, setSearch] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [framework, setFramework] = useState("All");
  const [sort, setSort] = useState("newest");
  const [viewMode, setViewMode] = useState("grid"); // grid | table

  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: 5,
    freeOnly: false,
    verifiedOnly: false,
  });

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getModels({
        category: category !== "All" ? category : undefined,
        search: search || undefined,
        sort,
      });
      const list = response.data?.models || (Array.isArray(response.data) ? response.data : []);
      setModels(list);
    } catch (err) {
      console.error("Failed to fetch models:", err);
      setError("Failed to load models. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [category, search, sort]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    const nextSearch = searchParams.get("search") || "";
    const nextCategory = searchParams.get("category") || "All";
    setSearch(nextSearch);
    setSearchInput(nextSearch);
    setCategory(CATEGORIES.includes(nextCategory) ? nextCategory : "All");
  }, [searchParams]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        if (searchInput) nextParams.set("search", searchInput);
        else nextParams.delete("search");
        return nextParams;
      }, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, setSearchParams]);

  // Client-side filtering
  const filteredModels = useMemo(() => {
    let result = [...models];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.name || "").toLowerCase().includes(q) ||
          (m.owner?.username || "").toLowerCase().includes(q) ||
          (m.description || "").toLowerCase().includes(q) ||
          (Array.isArray(m.tags) && m.tags.some((t) => String(t).toLowerCase().includes(q)))
      );
    }

    if (category !== "All") {
      result = result.filter((m) => m.category === category);
    }

    if (framework !== "All") {
      const fw = framework.toLowerCase();
      result = result.filter(
        (m) =>
          (m.framework || "").toLowerCase().includes(fw) ||
          (m.modelFormat || "").toLowerCase().includes(fw) ||
          (m.name || "").toLowerCase().includes(fw) ||
          (Array.isArray(m.tags) && m.tags.some((t) => String(t).toLowerCase().includes(fw)))
      );
    }

    if (filters.minPrice > 0) {
      result = result.filter((m) => (m.price || 0) >= filters.minPrice);
    }
    if (filters.maxPrice > 0) {
      result = result.filter((m) => (m.price || 0) <= filters.maxPrice);
    }

    if (filters.freeOnly) {
      result = result.filter((m) => m.price === 0);
    }

    if (filters.verifiedOnly) {
      result = result.filter((m) => m.verificationStatus === "verified");
    }

    if (sort === "price-asc") result.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sort === "price-desc") result.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (sort === "rating") result.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    else if (sort === "popular") result.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    else result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return result;
  }, [models, search, category, framework, sort, filters]);

  const skeletons = useMemo(
    () => Array(6).fill(0).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />),
    []
  );

  return (
    <div className="page-wrapper" style={{ paddingTop: 90 }}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          <span>⚡</span>
          <span>Decentralized AI Hub · 90% Creator Revenue</span>
        </div>
        <h1 className="section-title">
          Explore AI <span className="gradient-text">Weights & Models</span>
        </h1>
        <p style={{ color: "var(--text2)", marginTop: 8 }}>
          {loading
            ? "Loading decentralized models..."
            : `${filteredModels.length} model${filteredModels.length !== 1 ? "s" : ""} available on-chain with verified provenance`}
        </p>
      </div>

      <div className={styles.highlightStrip}>
        {MARKETPLACE_HIGHLIGHTS.map((item) => (
          <div key={item.label} className={styles.highlightCard}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.mainContent}>
        {/* Sidebar Filters */}
        <aside className={styles.sidebar}>
          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ marginBottom: "1.25rem", fontWeight: "700" }}>Filters & Sliders</h3>

            {/* Framework Filter */}
            <div className={styles.filterGroup}>
              <label style={{ fontWeight: "600", marginBottom: "0.5rem", display: "block", fontSize: "0.85rem", color: "#cbd5e1" }}>
                Target Framework
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {FRAMEWORKS.map((fw) => (
                  <button
                    key={fw}
                    onClick={() => {
                      soundFx.playClick();
                      setFramework(fw);
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: framework === fw ? "rgba(99,102,241,0.25)" : "transparent",
                      color: framework === fw ? "#818cf8" : "#94a3b8",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    {fw}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Filter */}
            <div className={styles.filterGroup}>
              <label style={{ fontWeight: "600", marginBottom: "0.75rem", display: "block", fontSize: "0.85rem", color: "#cbd5e1" }}>
                Max Price (ETH): <span style={{ color: "#00f5c4" }}>Ξ {filters.maxPrice}</span>
              </label>
              <input
                type="range"
                min="0.01"
                max="5"
                step="0.05"
                value={filters.maxPrice}
                onChange={(e) => setFilters({ ...filters, maxPrice: parseFloat(e.target.value) || 5 })}
                style={{ width: "100%", accentColor: "#00f5c4" }}
              />
            </div>

            {/* Checkboxes */}
            <div className={styles.filterGroup}>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer", marginBottom: "0.75rem", fontSize: "0.88rem" }}>
                <input
                  type="checkbox"
                  checked={filters.freeOnly}
                  onChange={(e) => {
                    soundFx.playClick();
                    setFilters({ ...filters, freeOnly: e.target.checked });
                  }}
                />
                <span>Free Models Only</span>
              </label>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer", fontSize: "0.88rem" }}>
                <input
                  type="checkbox"
                  checked={filters.verifiedOnly}
                  onChange={(e) => {
                    soundFx.playClick();
                    setFilters({ ...filters, verifiedOnly: e.target.checked });
                  }}
                />
                <span>Verified SHA-256 Only</span>
              </label>
            </div>

            {/* Reset Filters */}
            <button
              onClick={() => {
                soundFx.playClick();
                setFilters({ minPrice: 0, maxPrice: 5, freeOnly: false, verifiedOnly: false });
                setCategory("All");
                setFramework("All");
                setSearchInput("");
              }}
              className="btn btn-secondary btn-sm"
              style={{ width: "100%", marginTop: "1rem" }}
            >
              Reset All Filters
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className={styles.content}>
          {/* Toolbar with Search, Sort & View Mode Switcher */}
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search models, creators, tags..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <select
              className={styles.select}
              value={sort}
              onChange={(e) => {
                soundFx.playClick();
                setSort(e.target.value);
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* View Switcher (Grid vs Table) */}
            <div className={styles.viewSwitcher}>
              <button
                className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
                onClick={() => {
                  soundFx.playClick();
                  setViewMode("grid");
                }}
                title="Grid View"
              >
                ⊞ Cards
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === "table" ? styles.viewBtnActive : ""}`}
                onClick={() => {
                  soundFx.playClick();
                  setViewMode("table");
                }}
                title="Table Matrix View"
              >
                ☰ Matrix
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className={styles.categories}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`${styles.catBtn} ${category === cat ? styles.catActive : ""}`}
                onClick={() => {
                  soundFx.playClick();
                  setCategory(cat);
                  const nextParams = new URLSearchParams(searchParams);
                  if (cat !== "All") nextParams.set("category", cat);
                  else nextParams.delete("category");
                  setSearchParams(nextParams, { replace: true });
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 24 }}>
              <span>⚠️ {error}</span>
              <button className="btn btn-sm btn-ghost" onClick={fetchModels}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className={styles.grid}>{skeletons}</div>
          ) : filteredModels.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🔍</div>
              <h3>No matching models found</h3>
              <p>Try modifying your search keywords or loosening the framework filters.</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className={styles.grid}>
              {filteredModels.map((model) => (
                <ModelCard key={model._id || model.id} model={model} />
              ))}
            </div>
          ) : (
            <div className={styles.tableView}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Model Name</th>
                    <th>Category</th>
                    <th>Creator</th>
                    <th>Framework</th>
                    <th>Downloads</th>
                    <th>Rating</th>
                    <th>License Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map((model) => {
                    const modelId = model._id || model.id;
                    return (
                      <tr
                        key={modelId}
                        className={styles.tableRow}
                        onClick={() => {
                          soundFx.playClick();
                          navigate(`/model/${modelId}`);
                        }}
                      >
                        <td style={{ fontWeight: 700, color: "#fff" }}>
                          {model.name}
                          {model.verificationStatus === "verified" && (
                            <span style={{ marginLeft: 6, color: "#34d399", fontSize: "0.78rem" }}>✓</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-purple">{model.category}</span>
                        </td>
                        <td style={{ color: "#94a3b8" }}>{model.owner?.username || "Architect"}</td>
                        <td>
                          <span className="badge badge-cyan">{model.framework || "ONNX"}</span>
                        </td>
                        <td>{model.downloads || 0}</td>
                        <td>⭐ {model.rating || 5.0}</td>
                        <td style={{ fontWeight: 800, color: "#00f5c4" }}>
                          {model.price ? `Ξ ${model.price}` : "Free"}
                        </td>
                        <td>
                          <button className="btn btn-sm btn-primary">Launch ⚡</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
