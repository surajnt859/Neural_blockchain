import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getModerationQueue, moderateModel } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function Admin() {
  const { user } = useAuth();
  const [models, setModels] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    getModerationQueue().then((response) => setModels(response.data.models || [])).catch((err) => setError(err.response?.data?.error || "Could not load moderation queue."));
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  const updateStatus = async (model, status) => {
    const note = window.prompt(`Add an audit note for ${status}:`, "") || "";
    try {
      await moderateModel(model.id, status, note);
      setModels((current) => current.filter((entry) => entry.id !== model.id));
    } catch (err) {
      setError(err.response?.data?.error || "Could not update model moderation status.");
    }
  };

  return (
    <main className="page-wrapper" style={{ paddingTop: 110, maxWidth: 1000 }}>
      <h1 className="section-title">Trust & Safety <span className="gradient-text">Review Queue</span></h1>
      <p style={{ color: "var(--text2)", marginBottom: 28 }}>Review static scan results before models become visible or downloadable.</p>
      {error && <div className="alert alert-error">{error}</div>}
      {models.length === 0 ? <div className="glass-card" style={{ padding: 32 }}>No models are awaiting review.</div> : (
        <div style={{ display: "grid", gap: 16 }}>
          {models.map((model) => (
            <article key={model.id} className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ marginBottom: 6 }}>{model.name}</h2>
                  <div style={{ color: "var(--text3)", fontSize: "0.85rem" }}>{model.modelFormat} · {model.framework} · {model.owner?.email || "Unknown creator"}</div>
                </div>
                <span className="badge badge-outline">{model.verificationStatus}</span>
              </div>
              <p style={{ margin: "16px 0", color: "var(--text2)" }}>{model.description}</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "var(--text3)", fontSize: "0.85rem" }}>
                <span>Static score: {model.verificationScore}/100</span>
                <span>SHA-256: {model.modelHash || "not recorded"}</span>
              </div>
              {model.verificationWarnings?.length > 0 && <ul style={{ color: "#fbbf24", margin: "14px 0" }}>{model.verificationWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button className="btn btn-primary" onClick={() => updateStatus(model, "verified")}>Approve</button>
                <button className="btn btn-secondary" onClick={() => updateStatus(model, "needs_review")}>Request review</button>
                <button className="btn btn-outline" onClick={() => updateStatus(model, "rejected")}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}