import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getModelLeaderboard, getCreatorLeaderboard } from "../services/api";
import styles from "./Leaderboard.module.css";

export default function Leaderboard() {
  const [tab, setTab] = useState("models");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = tab === "models" ? await getModelLeaderboard() : await getCreatorLeaderboard();
        if (!cancelled) setData(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Leaderboard fetch error:", err);
        if (!cancelled) setError("Failed to load leaderboard data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [tab]);

  return (
    <div className="page-wrapper" style={{ paddingTop: 100, maxWidth: 1000 }}>
      <div className={styles.header}>
        <h1 className="section-title">Global <span className="gradient-text">Leaderboard</span></h1>
        <p className={styles.sub}>
          {tab === "models"
            ? "Top AI models ranked by rating × downloads from real platform data."
            : "Top creators ranked by reputation score derived from verified sales, reviews, and model activity."}
        </p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "models" ? styles.active : ""}`}
          onClick={() => setTab("models")}
        >
          🔥 Top Models
        </button>
        <button
          className={`${styles.tab} ${tab === "creators" ? styles.active : ""}`}
          onClick={() => setTab("creators")}
        >
          💎 Top Creators
        </button>
      </div>

      <div className={`glass-card ${styles.tableCard}`}>
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : error ? (
          <div className="alert alert-error" style={{ margin: "2rem" }}>
            ⚠️ {error}
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text2)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
            <h3>No leaderboard data available yet.</h3>
            <p style={{ marginTop: "0.5rem" }}>
              {tab === "models"
                ? "No models with rating and download activity found."
                : "No creators with verified activity found."}
            </p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>{tab === "models" ? "Model Name" : "Creator"}</th>
                <th>{tab === "models" ? "Rating" : "Reputation Score"}</th>
                <th>{tab === "models" ? "Downloads" : "Avg Rating"}</th>
                <th>{tab === "models" ? "Blockchain Status" : "Verified Models"}</th>
                {tab === "creators" && (
                  <>
                    <th>Sales</th>
                    <th>Downloads</th>
                    <th>Reviews</th>
                    <th>Trust Level</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i} className={styles.row}>
                  {/* Rank */}
                  <td>
                    <span className={`${styles.rank} ${i < 3 ? styles[`rank${i + 1}`] : ""}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                  </td>

                  {/* Name */}
                  <td>
                    <div className={styles.nameCell}>
                      <div className={styles.avatar}>{tab === "models" ? "🤖" : "👤"}</div>
                      <div>
                        <div className={styles.mainName}>
                          {tab === "models" ? (
                            <Link to={`/model/${item.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                              {item.name}
                            </Link>
                          ) : (
                            item.username
                          )}
                        </div>
                        <div className={styles.subName}>
                          {tab === "models"
                            ? `by ${item.owner?.username || "Anonymous"}`
                            : item.trustLevel}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Rating / Reputation */}
                  <td>
                    {tab === "models"
                      ? (item.liveRating > 0
                          ? `⭐ ${item.liveRating} (${item.reviewCount} review${item.reviewCount !== 1 ? "s" : ""})`
                          : "N/A")
                      : <strong className={styles.score}>{item.reputationScore}/100</strong>}
                  </td>

                  {/* Downloads / Avg Rating */}
                  <td>
                    {tab === "models"
                      ? `${(item.downloads || 0).toLocaleString()} downloads`
                      : (item.averageRating > 0 ? `⭐ ${item.averageRating}/5` : "N/A")}
                  </td>

                  {/* Blockchain Status / Verified Models */}
                  <td>
                    {tab === "models"
                      ? (item.isBlockchainListed
                        ? <span className="badge badge-cyan">✓ Blockchain Listed</span>
                        : <span className="badge badge-outline" style={{ opacity: 0.7 }}>Legacy</span>)
                      : `${item.verifiedModels}/${item.modelCount}`}
                  </td>

                  {/* Creator-only columns */}
                  {tab === "creators" && (
                    <>
                      <td>{item.sales}</td>
                      <td>{(item.totalDownloads || 0).toLocaleString()}</td>
                      <td>{item.reviews}</td>
                      <td><span className="badge badge-cyan">{item.trustLevel}</span></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ranking methodology note */}
      <div style={{ marginTop: "1.5rem", padding: "1rem 1.5rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "0.82rem", color: "var(--text3)" }}>
        {tab === "models"
          ? "📊 Models ranked by live verified-review average × downloads. Rating = average of real verified buyer reviews. Models with no reviews show N/A."
          : "📊 Creator Reputation Score = 30% avg rating + 25% verified models + 20% verified sales + 15% downloads + 10% reviews. All values from verified buyer reviews."}
      </div>
    </div>
  );
}
