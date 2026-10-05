import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useWeb3 } from "../context/Web3Context.jsx";
import { getBounties, createBounty, submitBountySolution, getModels } from "../services/api";
import { soundFx } from "../services/soundFx";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal.jsx";
import styles from "./Bounties.module.css";

const CATEGORIES = ["All", "Audio", "Computer Vision", "LLM", "Code & Reasoning", "General AI"];

export default function Bounties() {
  const { user } = useAuth();
  const { account, ethBalance, neuralBalance } = useWeb3();
  const toast = useToast();

  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [userModels, setUserModels] = useState([]);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Audio");
  const [rewardAmount, setRewardAmount] = useState("1.5");
  const [rewardToken, setRewardToken] = useState("ETH");
  const [benchmarkMetric, setBenchmarkMetric] = useState("WER < 4.0% on noisy audio");
  const [targetAccuracy, setTargetAccuracy] = useState("95.0");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  // Submit Modal
  const [submitOpen, setSubmitOpen] = useState(false);
  const [activeBounty, setActiveBounty] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => {
    fetchBounties();
    fetchUserModels();
  }, [selectedCategory]);

  const fetchBounties = async () => {
    setLoading(true);
    try {
      const res = await getBounties({ category: selectedCategory });
      setBounties(res.data.bounties || []);
    } catch (err) {
      console.error("Failed to fetch bounties:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserModels = async () => {
    try {
      const res = await getModels();
      setUserModels(res.data.models || []);
      if (res.data.models?.length > 0) {
        setSelectedModelId(res.data.models[0].id);
      }
    } catch (err) {}
  };

  const handleCreateBounty = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateMsg("");
    soundFx.playClick();
    try {
      const payload = {
        title,
        description,
        category,
        rewardAmount: parseFloat(rewardAmount),
        rewardToken,
        benchmarkMetric,
        targetAccuracy: parseFloat(targetAccuracy),
        walletAddress: account,
      };
      await createBounty(payload);
      soundFx.playSuccess();
      toast.success("Bounty Created", "Prize pool locked in escrow contract.");
      setCreateMsg("✅ Bounty created and escrow prize pool locked!");
      setTimeout(() => {
        setCreateOpen(false);
        setCreateMsg("");
        fetchBounties();
      }, 1200);
    } catch (err) {
      soundFx.playWarning();
      setCreateMsg(`❌ ${err.response?.data?.error || err.message}`);
      toast.error("Creation Failed", "Could not lock bounty escrow.");
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitSolution = async (e) => {
    e.preventDefault();
    if (!activeBounty || !selectedModelId) return;
    setSubmitting(true);
    setSubmitResult(null);
    soundFx.playPop();

    try {
      const res = await submitBountySolution(activeBounty.id, {
        modelId: selectedModelId,
        walletAddress: account,
      });
      setSubmitResult({
        success: true,
        message: res.data.message,
        submission: res.data.submission,
        passed: res.data.passed,
      });
      if (res.data.passed) {
        soundFx.playSuccess();
        toast.success("Benchmark Passed! 🏆", "You have qualified for the bounty prize pool!");
      } else {
        soundFx.playWarning();
        toast.info("Submission Evaluated", `Score: ${res.data.submission?.accuracyScore}% (Target: ${activeBounty.targetAccuracy}%)`);
      }
      fetchBounties();
    } catch (err) {
      soundFx.playWarning();
      setSubmitResult({
        success: false,
        message: err.response?.data?.error || "Failed to submit model.",
      });
      toast.error("Submission Error", "Failed to verify benchmark.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.bountiesContainer}>
      <div className={styles.headerSection}>
        <div className={styles.titleArea}>
          <h1>AI Model Bounties (RFM)</h1>
          <p>
            Enterprises & DAOs post escrowed bounties for custom AI fine-tunes, datasets, and benchmark targets.
            Submit your verified models to claim prize pools.
          </p>
        </div>
        <button
          className={styles.createBountyBtn}
          onClick={() => {
            soundFx.playClick();
            setCreateOpen(true);
          }}
        >
          ➕ Post AI Bounty
        </button>
      </div>

      <div className={styles.filterBar}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`${styles.filterBtn} ${selectedCategory === cat ? styles.filterBtnActive : ""}`}
            onClick={() => {
              soundFx.playClick();
              setSelectedCategory(cat);
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
          Loading live RFM bounties...
        </div>
      ) : bounties.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
          No bounties found in this category. Be the first to post one!
        </div>
      ) : (
        <div className={styles.bountyGrid}>
          {bounties.map((bounty) => (
            <div key={bounty.id} className={styles.bountyCard}>
              <div>
                <div className={styles.cardHeader}>
                  <span className={styles.categoryBadge}>{bounty.category}</span>
                  <div className={styles.rewardBadge}>
                    🏆 {bounty.rewardAmount} {bounty.rewardToken}
                  </div>
                </div>

                <h3 className={styles.bountyTitle}>{bounty.title}</h3>
                <p className={styles.bountyDesc}>{bounty.description}</p>

                <div className={styles.specsBox}>
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>Benchmark Target:</span>
                    <span className={styles.specValue}>{bounty.benchmarkMetric}</span>
                  </div>
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>Min Score:</span>
                    <span className={styles.specValue}>{bounty.targetAccuracy}%</span>
                  </div>
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>Framework:</span>
                    <span className={styles.specValue}>{bounty.frameworkRequirements}</span>
                  </div>
                  <div className={styles.specRow}>
                    <span className={styles.specLabel}>Submissions:</span>
                    <span className={styles.specValue}>{bounty.submissions?.length || 0} models</span>
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <div className={styles.sponsorInfo}>
                  Sponsor: <span className={styles.sponsorName}>{bounty.sponsor?.username}</span>
                </div>
                <button
                  className={styles.submitBtn}
                  onClick={() => {
                    setActiveBounty(bounty);
                    setSubmitResult(null);
                    setSubmitOpen(true);
                  }}
                >
                  🚀 Submit Model
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Bounty Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Post an AI Model Bounty">
        <form onSubmit={handleCreateBounty} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Bounty Title</label>
            <input
              type="text"
              placeholder="e.g., Ultra-Fast Medical Transcription ONNX Model"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Detailed Specifications & Use Case</label>
            <textarea
              rows={3}
              placeholder="Describe requirements, target datasets, and acceptable error rates..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Domain Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Audio">Audio / Speech-to-Text</option>
                <option value="Computer Vision">Computer Vision</option>
                <option value="LLM">LLM & Text Generation</option>
                <option value="Code & Reasoning">Code & Reasoning</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Reward Prize</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="number"
                  step="0.1"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  required
                />
                <select value={rewardToken} onChange={(e) => setRewardToken(e.target.value)}>
                  <option value="ETH">ETH</option>
                  <option value="NEURAL">NEURAL</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Target Benchmark Metric</label>
              <input
                type="text"
                value={benchmarkMetric}
                onChange={(e) => setBenchmarkMetric(e.target.value)}
                placeholder="e.g. WER < 4.0%"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Target Accuracy % Threshold</label>
              <input
                type="number"
                value={targetAccuracy}
                onChange={(e) => setTargetAccuracy(e.target.value)}
                required
              />
            </div>
          </div>

          {createMsg && (
            <div style={{ color: createMsg.startsWith("✅") ? "#34d399" : "#f87171", fontSize: "0.9rem" }}>
              {createMsg}
            </div>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={styles.modalCancelBtn} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.modalSubmitBtn} disabled={creating}>
              {creating ? "Locking Escrow..." : "Deposit & Publish Bounty"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Solution Modal */}
      <Modal
        isOpen={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title={`Submit Model for: ${activeBounty?.title || "Bounty"}`}
      >
        <form onSubmit={handleSubmitSolution} className={styles.modalForm}>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
            Select an active model from your repository to run against the automated evaluation benchmark suite.
          </p>

          <div className={styles.formGroup}>
            <label>Select AI Model</label>
            <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)} required>
              {userModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.framework} - {m.verificationScore}% Score)
                </option>
              ))}
            </select>
          </div>

          {submitResult && (
            <div
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: submitResult.passed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${submitResult.passed ? "#10b981" : "#ef4444"}`,
                color: "#f8fafc",
                fontSize: "0.9rem",
              }}
            >
              <strong>{submitResult.passed ? "🎉 Benchmark Passed!" : "⚠️ Benchmark Result:"}</strong>
              <div>{submitResult.message}</div>
              {submitResult.submission && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
                  Evaluated Score: <strong>{submitResult.submission.benchmarkScore}%</strong> (Target:{" "}
                  {activeBounty?.targetAccuracy}%)
                </div>
              )}
            </div>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={styles.modalCancelBtn} onClick={() => setSubmitOpen(false)}>
              Close
            </button>
            <button type="submit" className={styles.modalSubmitBtn} disabled={submitting}>
              {submitting ? "Evaluating Model..." : "Run Automated Evaluation & Submit"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
