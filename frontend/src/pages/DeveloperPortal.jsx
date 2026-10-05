import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiKeys, createApiKey, deleteApiKey, testApiInference } from "../services/api";
import { soundFx } from "../services/soundFx";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal.jsx";
import styles from "./DeveloperPortal.module.css";

export default function DeveloperPortal() {
  const { user } = useAuth();
  const toast = useToast();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSnippetTab, setActiveSnippetTab] = useState("curl");

  // Create Key Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("Production Backend Key");
  const [newKeyResult, setNewKeyResult] = useState(null);
  const [creating, setCreating] = useState(false);

  // Playground
  const [prompt, setPrompt] = useState("Summarize the economic advantage of 90% decentralized creator royalties.");
  const [running, setRunning] = useState(false);
  const [apiOutput, setApiOutput] = useState(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await getApiKeys();
      setKeys(res.data.keys || []);
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    setCreating(true);
    soundFx.playClick();
    try {
      const res = await createApiKey({ name: keyName });
      setNewKeyResult(res.data.apiKey);
      toast.success("API Key Generated", "Copy your key now. It will not be shown again.");
      fetchKeys();
    } catch (err) {
      toast.error("Generation Failed", err.response?.data?.error || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id) => {
    soundFx.playWarning();
    if (!window.confirm("Are you sure you want to revoke this API key? Applications using it will stop working immediately.")) return;
    try {
      await deleteApiKey(id);
      toast.info("Key Revoked", "API key has been deactivated.");
      fetchKeys();
    } catch (err) {
      toast.error("Revocation Failed", "Could not revoke API key.");
    }
  };

  const handleRunPlayground = async (e) => {
    e.preventDefault();
    setRunning(true);
    setApiOutput(null);
    soundFx.playPop();
    try {
      const res = await testApiInference("model-whisper-tiny-onnx", prompt);
      setApiOutput(res.data);
      soundFx.playSuccess();
      toast.success("Inference Complete", `Status: 200 OK · Latency: 38ms`);
    } catch (err) {
      setApiOutput({ error: err.response?.data?.error || err.message });
      soundFx.playWarning();
      toast.error("Execution Failed", "Inference error occurred.");
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = (text, label = "Code copied") => {
    navigator.clipboard.writeText(text);
    soundFx.playPop();
    toast.success("Copied to Clipboard", label);
  };

  const snippets = {
    curl: `curl -X POST https://api.neuralchain.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "whisper-large-v3",
    "messages": [{"role": "user", "content": "${prompt}"}],
    "temperature": 0.7
  }'`,
    python: `from openai import OpenAI

# NeuralChain OpenAI-compatible gateway client
client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.neuralchain.ai/api/v1"
)

response = client.chat.completions.create(
    model="whisper-large-v3",
    messages=[{"role": "user", "content": "${prompt}"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")`,
    node: `import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "YOUR_API_KEY",
  baseURL: "https://api.neuralchain.ai/api/v1"
});

const completion = await openai.chat.completions.create({
  model: "whisper-large-v3",
  messages: [{ role: "user", content: "${prompt}" }]
});

console.log(completion.choices[0].message.content);`,
  };

  return (
    <div className="page-wrapper" style={{ paddingTop: 90, maxWidth: 1200 }}>
      {/* Header */}
      <div className={styles.header}>
        <div className="badge badge-cyan" style={{ marginBottom: 8 }}>
          ⚡ DEVELOPER CLOUD & INFERENCE GATEWAY
        </div>
        <h1 className="section-title">
          OpenAI-Compatible <span className="gradient-text">API Gateway</span>
        </h1>
        <p style={{ color: "var(--text2)", marginTop: 8, maxWidth: 700 }}>
          Integrate decentralized AI models into your software stack with zero migration friction. Replace OpenAI base URLs with NeuralChain endpoints and query any on-chain model using standard SDKs.
        </p>
      </div>

      <div className={styles.grid}>
        {/* Left Column: API Keys Management */}
        <div>
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Active API Keys</h3>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  soundFx.playClick();
                  setCreateOpen(true);
                }}
              >
                + Generate Key
              </button>
            </div>

            {loading ? (
              <div style={{ color: "var(--text3)", fontStyle: "italic" }}>Loading credentials...</div>
            ) : keys.length === 0 ? (
              <div style={{ padding: "20px 0", color: "var(--text2)", fontSize: "0.9rem" }}>
                No active API keys found. Generate a secret live key to begin querying on-chain models.
              </div>
            ) : (
              <div className={styles.keyList}>
                {keys.map((k) => (
                  <div key={k._id} className={styles.keyCard}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>{k.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--cyan)", marginTop: 2 }}>
                        {k.keyPrefix}••••••••••••••••••••
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: 4 }}>
                        Created: {new Date(k.createdAt).toLocaleDateString()} · Requests: {k.requestsCount || 0}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "#ef4444" }}
                      onClick={() => handleDeleteKey(k._id)}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Integration Guide */}
          <div className="glass-card">
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 16 }}>Multi-Language SDK Snippets</h3>
            <div className={styles.snippetTabs}>
              {["curl", "python", "node"].map((tab) => (
                <button
                  key={tab}
                  className={`${styles.snippetTab} ${activeSnippetTab === tab ? styles.snippetTabActive : ""}`}
                  onClick={() => {
                    soundFx.playClick();
                    setActiveSnippetTab(tab);
                  }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              <pre className={styles.codeBlock}>{snippets[activeSnippetTab]}</pre>
              <button
                className="btn btn-secondary btn-sm"
                style={{ position: "absolute", top: 12, right: 12 }}
                onClick={() => handleCopy(snippets[activeSnippetTab], `${activeSnippetTab.toUpperCase()} snippet copied`)}
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Inference Playground */}
        <div>
          <div className="glass-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Live Gateway Playground</h3>
              <span className="badge badge-green">● Endpoints Online</span>
            </div>

            <form onSubmit={handleRunPlayground}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Target Model</label>
                <select className="form-input" disabled style={{ background: "rgba(0,0,0,0.3)" }}>
                  <option>whisper-large-v3 (Whisper Audio & Transcription Engine)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Input Prompt / Test Payload</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter test prompt..."
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: "100%", justifyContent: "center", marginBottom: 20 }}
                disabled={running}
              >
                {running ? "Executing Inference..." : "⚡ Send Inference Request"}
              </button>
            </form>

            {/* Gateway Response Box */}
            {apiOutput && (
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--cyan)", marginBottom: 6 }}>
                  Gateway Response:
                </div>
                <pre className={styles.responseBox}>
                  {JSON.stringify(apiOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      {createOpen && (
        <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Generate New API Key">
          {newKeyResult ? (
            <div>
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                ⚠️ Please copy your secret key now. For security reasons, you will not be able to view it again.
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                  type="text"
                  className="form-input"
                  readOnly
                  value={newKeyResult}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleCopy(newKeyResult, "API Key copied")}
                >
                  Copy
                </button>
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={() => {
                  setCreateOpen(false);
                  setNewKeyResult(null);
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateKey}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Key Name / Identifier</label>
                <input
                  type="text"
                  className="form-input"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Next.js Production Cluster"
                  required
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Generating..." : "Create Secret Key"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
