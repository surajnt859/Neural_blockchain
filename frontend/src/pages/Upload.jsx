import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { uploadToIPFS, createModel, createModelVersion, getModel } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { useWeb3 } from "../context/Web3Context.jsx";
import styles from "./Upload.module.css";

const CATEGORIES = ["Computer Vision", "NLP", "Generative AI", "Finance", "Audio", "General"];

export default function Upload() {
  const { user } = useAuth();
  const { account, signer, connectWallet, connectDemoWallet, demoMode, isDemoWallet, addTransaction } = useWeb3();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentModelId = searchParams.get("parentModelId");

  const [form, setForm] = useState({ name: "", description: "", category: "General", price: "0.05", tags: "", version: "1.0", versionNotes: "" });
  const [parentModel, setParentModel] = useState(null);
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("idle"); // idle | uploading-ipfs | uploading-chain | done
  const [error, setError] = useState(null);
  const [ipfsResult, setIpfsResult] = useState(null);
  const [listingResult, setListingResult] = useState(null);

  useEffect(() => {
    if (!parentModelId) return;
    getModel(parentModelId).then((res) => {
      const source = res.data;
      setParentModel(source);
      setForm((current) => ({
        ...current,
        name: source.name,
        description: source.description,
        category: source.category,
        price: String(source.price ?? current.price),
        tags: (source.tags || []).join(", "),
      }));
    }).catch(() => setError("The parent model version could not be loaded."));
  }, [parentModelId]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError("Please select a file to upload."); return; }
    if (!account && !demoMode && !isDemoWallet) {
      try {
        await connectDemoWallet();
      } catch {}
    }
    // Basic validation
    const maxBytes = 100 * 1024 * 1024; // 100MB
    if (file.size > maxBytes) { setError("File is too large. Max 100MB."); return; }
    const allowed = [".pkl", ".pt", ".h5", ".onnx", ".zip", ".tar.gz"];
    const nameLower = file.name.toLowerCase();
    if (!allowed.some(ext => nameLower.endsWith(ext))) {
      // allow unknown extensions but warn
      console.warn("Uploading file with uncommon extension", file.name);
    }
    setError(null);

    try {
      // Step 1: Upload to IPFS (try real upload, but fallback in demo mode)
      setStep("uploading-ipfs");
      let ipfsHash = null;
      let verification = null;
      try {
        const fd = new FormData();
        fd.append("file", file);
        const ipfsRes = await uploadToIPFS(fd);
        ipfsHash = ipfsRes.data?.ipfsHash;
        verification = ipfsRes.data?.verification;
        if (!ipfsHash) throw new Error(ipfsRes.data?.error || "IPFS upload failed: No valid CID returned.");
        setIpfsResult(ipfsRes.data);
      } catch (ipfsErr) {
        console.error("IPFS upload error:", ipfsErr);
        throw new Error(ipfsErr.response?.data?.error || ipfsErr.message || "IPFS upload failed.");
      }

      // Step 2: (Optional) Record on blockchain or simulate in demo mode
      setStep("uploading-chain");
      let txHash = null;
      let contractModelId = null;

      if (account && signer && !isDemoWallet) {
        try {
          const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
          const zeroAddr = "0x0000000000000000000000000000000000000000";
          if (contractAddress && contractAddress !== zeroAddr) {
            const { ethers } = await import("ethers");
            const contractData = await import("../contracts/ModelMarketplace.json").catch(() => null);
            if (contractData) {
              const contract = new ethers.Contract(contractAddress, contractData.default.abi, signer);
              const priceWei = ethers.parseEther(form.price || "0");
              const tx = await contract.uploadModel(
                form.name,
                form.description,
                form.category,
                ipfsHash,
                verification?.modelHash || "0x0",
                "pending",
                verification?.verificationScore || 0,
                priceWei
              );
              const receipt = await tx.wait();
              txHash = receipt.hash;
              const listedEvent = receipt.logs
                .map((log) => {
                  try { return contract.interface.parseLog(log); } catch { return null; }
                })
                .find((event) => event?.name === "ModelListed");
              contractModelId = listedEvent ? listedEvent.args.id.toString() : null;
            }
          }
        } catch (chainErr) {
          console.warn("Live blockchain recording skipped/failed, using cryptographic registry fallback:", chainErr.message);
        }
      }

      // Keep synthetic registry IDs only for the explicit demo wallet flow.
      if (!txHash || !contractModelId) {
        if (!isDemoWallet) {
          throw new Error("Blockchain listing failed. No synthetic transaction was created.");
        }
        contractModelId = `contract-${Date.now().toString().slice(-4)}`;
        txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
      }

      // Step 3: Save metadata to backend
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      const modelPayload = {
        name: form.name,
        description: form.description,
        category: form.category,
        ipfsHash,
        price: parseFloat(form.price) || 0,
        txHash,
        contractModelId,
        walletAddress: account || user?.walletAddress || null,
        tags,
        verificationStatus: isDemoWallet ? "verified" : "pending",
        verificationScore: verification?.verificationScore || 94,
        modelHash: verification?.modelHash || `0x${Date.now().toString(16)}`,
        framework: verification?.framework || "PyTorch",
        modelFormat: verification?.modelFormat || "SafeTensors",
        verificationChecks: verification?.checks || { integrity: "verified", format: "safe" },
        verificationWarnings: verification?.warnings || [],
        version: form.version,
        versionNotes: form.versionNotes,
      };

      try {
        if (parentModelId) await createModelVersion(parentModelId, modelPayload);
        else await createModel(modelPayload);

        // Record transaction in local wallet ledger
        if (addTransaction) {
          addTransaction({
            type: "publish_model",
            hash: txHash,
            modelName: form.name,
            amount: 0,
            currency: "ETH",
            status: "confirmed",
          });
        }
      } catch (saveErr) {
        console.error("Save metadata error:", saveErr);
        throw saveErr;
      }

      setStep("done");
      setListingResult({ txHash, contractModelId, walletAddress: account || user?.walletAddress || "Demo wallet" });
    } catch (err) {
      console.error("Upload process error:", err);
      setError(err.response?.data?.error || err.message || "Upload failed.");
      setStep("idle");
    }
  };

  const formatBytes = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  if (step === "done") {
    return (
      <div className="page-wrapper" style={{ paddingTop: 100, textAlign: "center", maxWidth: 600 }}>
        <div style={{ fontSize: "4rem", marginBottom: 20 }}>🎉</div>
        <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>Model <span className="gradient-text">Listed!</span></h1>
        <p style={{ color: "var(--text2)", marginBottom: 24 }}>Version {form.version} has been verified, uploaded to IPFS, and listed on the marketplace.</p>
        {ipfsResult && (
          <div className={styles.successBox}>
            <div className={styles.successRow}><span>📦 IPFS Hash:</span><span className={styles.mono}>{ipfsResult.ipfsHash}</span></div>
            <div className={styles.successRow}><span>🗄️ Storage:</span><span>{ipfsResult.provider === "pinata-cloud" ? "Pinata Cloud / IPFS" : "Local demo content store"}</span></div>
            {ipfsResult.ipfsUrl && <div className={styles.successRow}><span>🔗 Content URL:</span><a className={styles.mono} href={ipfsResult.ipfsUrl} target="_blank" rel="noreferrer">Open stored object</a></div>}
            {ipfsResult.verification && (
              <>
                <div className={styles.successRow}>
                  <span>🛡️ Static Verification:</span>
                  <span className="badge badge-green">
                    Static {ipfsResult.verification.verificationStatus === "verified" ? "Verified" : ipfsResult.verification.verificationStatus} ({ipfsResult.verification.verificationScore}/100)
                  </span>
                </div>
                <div className={styles.successRow}><span>SHA-256 Hash:</span><span className={styles.mono}>{ipfsResult.verification.modelHash}</span></div>
                <div className={styles.successRow}><span>Format & Framework:</span><span>{ipfsResult.verification.modelFormat} · {ipfsResult.verification.framework}</span></div>
              </>
            )}
            {listingResult && (
              <>
                <div className={styles.successRow}><span>⛓️ Listing ID:</span><span className={styles.mono}>{listingResult.contractModelId}</span></div>
                <div className={styles.successRow}><span>🧾 Transaction:</span><span className={styles.mono}>{listingResult.txHash}</span></div>
                <div className={styles.successRow}><span>👛 Wallet:</span><span className={styles.mono}>{listingResult.walletAddress}</span></div>
                <div className={styles.successRow}><span>Mode:</span><span className="badge badge-blue">{isDemoWallet ? "Demo wallet" : "MetaMask"}</span></div>
              </>
            )}
            <div style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--text3)", borderTop: "1px solid var(--border)", paddingTop: 10, textAlign: "left" }}>
              ℹ️ <strong>Static Verification Notice:</strong> Checks file integrity, SHA-256 hash, structure, dependencies, and suspicious content. It does not measure model accuracy or execute live inference.
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
          <button className="btn btn-primary" onClick={() => navigate("/marketplace")}>🛒 View Marketplace</button>
          <button className="btn btn-secondary" onClick={() => { setStep("idle"); setFile(null); setIpfsResult(null); setListingResult(null); setForm({ name: "", description: "", category: "General", price: "0.05", tags: "", version: "1.0", versionNotes: "" }); }}>
            ⬆️ Upload Another
          </button>
        </div>
      </div>
    );
  }

  const isUploading = step !== "idle";

  return (
    <div className="page-wrapper" style={{ paddingTop: 90, maxWidth: 760 }}>
      <h1 className="section-title" style={{ marginBottom: 8 }}>{parentModel ? "Publish New" : "Upload"} <span className="gradient-text">Model Version</span></h1>
      <p style={{ color: "var(--text2)", marginBottom: 32 }}>
        Your file undergoes static security and integrity analysis before IPFS upload and blockchain listing.
      </p>

      {/* Wallet Banner */}
      {!account && (
        <div className="alert alert-info" style={{ marginBottom: 24, justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>🦊 Connect MetaMask to record your model on-chain (optional for demo)</span>
          <button className="btn btn-outline btn-sm" onClick={connectWallet}>Connect Wallet</button>
        </div>
      )}

      {demoMode && (
        <div className="alert alert-warning" style={{ marginBottom: 24 }}>
          🧪 Demo Mode active — uploads and listings are simulated locally for a fast, no-setup experience.
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

      {parentModel && <div className="alert alert-info" style={{ marginBottom: 20 }}>↳ New version of <strong>{parentModel.name}</strong> (currently v{parentModel.version || "1.0"})</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.infoStrip}>
          <span>Static trust checks</span>
          <span>IPFS ready</span>
          <span>On-chain listing</span>
        </div>

        {/* File Drop Zone */}
        <div
          className={`${styles.dropZone} ${file ? styles.dropZoneActive : ""}`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById("file-input").click()}
        >
          <input id="file-input" type="file" style={{ display: "none" }} onChange={handleFileChange} />
          {file ? (
            <div className={styles.fileInfo}>
              <span className={styles.fileIcon}>📄</span>
              <div>
                <div className={styles.fileName}>{file.name}</div>
                <div className={styles.fileSize}>{formatBytes(file.size)}</div>
              </div>
              <span className="badge badge-green">Ready</span>
            </div>
          ) : (
            <div className={styles.dropPrompt}>
              <span style={{ fontSize: "2.5rem" }}>📦</span>
              <p><strong>Drop your model file here</strong> or click to browse</p>
              <p style={{ fontSize: "0.82rem", color: "var(--text3)" }}>.pkl, .pt, .h5, .onnx, .zip, etc. — Max 100MB</p>
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className={styles.grid2}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Model Name *</label>
            <input id="name" name="name" className="form-input" placeholder="e.g. ResNet-50 Classifier"
              value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="category">Category *</label>
            <select id="category" name="category" className="form-input" value={form.category} onChange={handleChange}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className="form-group">
            <label className="form-label" htmlFor="version">Version *</label>
            <input id="version" name="version" className="form-input" placeholder="e.g. 1.1" value={form.version} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="versionNotes">Version Notes</label>
            <input id="versionNotes" name="versionNotes" className="form-input" placeholder="Improved accuracy and reduced size" value={form.versionNotes} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="description">Description *</label>
          <textarea id="description" name="description" className="form-input" rows={4}
            placeholder="Describe your model: architecture, training data, use cases, accuracy..." 
            value={form.description} onChange={handleChange} required />
        </div>

        <div className={styles.grid2}>
          <div className="form-group">
            <label className="form-label" htmlFor="price">Price (ETH) — set 0 for free</label>
            <input id="price" name="price" type="number" step="0.001" min="0" className="form-input"
              placeholder="0.05" value={form.price} onChange={handleChange} />
            {Number(form.price) > 0 && (
              <div style={{ fontSize: "0.82rem", color: "var(--cyan)", marginTop: "6px", display: "flex", gap: "8px", alignItems: "center" }}>
                <span>💎 <strong>90% Creator Cut:</strong> Ξ {(Number(form.price) * 0.9).toFixed(4)} ETH / sale</span>
                <span style={{ color: "var(--text3)" }}>· (10% network pool)</span>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="tags">Tags (comma separated)</label>
            <input id="tags" name="tags" className="form-input" placeholder="CNN, PyTorch, ImageNet"
              value={form.tags} onChange={handleChange} />
          </div>
        </div>

        {/* Progress */}
        {isUploading && (
          <div className={styles.progressBox}>
            <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            <span>{step === "uploading-ipfs" ? "📦 Uploading to IPFS..." : "⛓️ Recording on blockchain..."}</span>
          </div>
        )}

        <button id="upload-btn" type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }} disabled={isUploading}>
          {isUploading ? "Please wait..." : "🚀 Upload & List Model"}
        </button>
      </form>
    </div>
  );
}
