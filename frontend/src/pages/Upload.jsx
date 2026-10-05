import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { uploadToIPFS, createModel, getModel } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { useWeb3 } from "../context/Web3Context.jsx";
import styles from "./Upload.module.css";

const CATEGORIES = ["Computer Vision", "NLP", "Generative AI", "Finance", "Audio", "General"];

export default function Upload() {
  const { user } = useAuth();
  const { account, signer, connectWallet } = useWeb3();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentModelId = searchParams.get("parentModelId");

  const [form, setForm] = useState({ name: "", description: "", category: "General", architecture: "", price: "0.05", tags: "", version: "1.0", versionNotes: "" });
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
    if (!user) { setError("Log in before uploading a model."); return; }
    if (!account || !signer) { setError("Connect MetaMask before uploading a model."); return; }
    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0.001) {
      setError("On-chain model listings require a price of at least 0.001 ETH.");
      return;
    }
    // Basic validation
    const maxBytes = 100 * 1024 * 1024; // 100MB
    if (file.size > maxBytes) { setError("File is too large. Max 100MB."); return; }
    const allowed = [".onnx", ".pt", ".pth", ".h5", ".keras", ".safetensors", ".zip", ".json"];
    const nameLower = file.name.toLowerCase();
    if (!allowed.some(ext => nameLower.endsWith(ext))) {
      // allow unknown extensions but warn
      console.warn("Uploading file with uncommon extension", file.name);
    }
    setError(null);

    try {
      // Step 1: Verify and upload the encrypted paid-model bytes.
      setStep("uploading-ipfs");
      let ipfsHash = null;
      let verification = null;
      let encryptedUploadId = null;
      let keyHash = null;
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", form.name);
        fd.append("description", form.description);
        fd.append("category", form.category);
        fd.append("architecture", form.architecture);
        fd.append("price", form.price);
        fd.append("tags", form.tags);
        fd.append("version", form.version);
        if (parentModelId) fd.append("parentModelId", parentModelId);
        const ipfsRes = await uploadToIPFS(fd);
        ipfsHash = ipfsRes.data?.ipfsHash;
        verification = ipfsRes.data?.verification;
        encryptedUploadId = ipfsRes.data?.encryptedUploadId;
        keyHash = ipfsRes.data?.keyHash;
        if (!ipfsHash) throw new Error(ipfsRes.data?.error || "IPFS upload failed: No valid CID returned.");
        setIpfsResult(ipfsRes.data);
      } catch (ipfsErr) {
        console.error("IPFS upload error:", ipfsErr);
        throw new Error(ipfsErr.response?.data?.error || ipfsErr.message || "IPFS upload failed.");
      }

      // Step 2: Record the compact listing reference on-chain.
      setStep("uploading-chain");
      let txHash = null;
      let contractModelId = null;
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error("Marketplace contract address is not configured.");
      }
      const { ethers } = await import("ethers");
      const contractData = await import("../contracts/ModelMarketplace.json");
      const contract = new ethers.Contract(contractAddress, contractData.default.abi, signer);
      if (!verification?.modelHash || !keyHash || !encryptedUploadId) {
        throw new Error("Paid model upload did not return its integrity hash and encrypted key reference.");
      }
      const contentHash = `0x${verification.modelHash.replace(/^0x/, "")}`;
      const contentKeyHash = `0x${keyHash}`;
      let tx;
      if (parentModel?.contractModelId && /^\d+$/.test(String(parentModel.contractModelId))) {
        tx = await contract.uploadModelWithLineage(
          ipfsHash,
          contentHash,
          contentKeyHash,
          ethers.parseEther(form.price),
          BigInt(parentModel.contractModelId)
        );
      } else {
        tx = await contract.uploadModel(
          ipfsHash,
          contentHash,
          contentKeyHash,
          ethers.parseEther(form.price)
        );
      }
      const receipt = await tx.wait();
      txHash = receipt.hash;
      const listedEvent = receipt.logs
        .map((log) => {
          try { return contract.interface.parseLog(log); } catch { return null; }
        })
        .find((event) => event?.name === "ModelListed");
      contractModelId = listedEvent ? listedEvent.args.id.toString() : null;
      if (!contractModelId) throw new Error("Listing transaction succeeded but emitted no model ID.");

      // Step 3: Save metadata to backend
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      const walletTimestamp = Date.now();
      const walletSignature = await signer.signMessage(
        `NeuralChain creator wallet:${user.id}:${account.toLowerCase()}:${walletTimestamp}`
      );
      const modelPayload = {
        name: form.name,
        fileName: file.name,
        description: form.description,
        category: form.category,
        ipfsHash,
        price: parseFloat(form.price) || 0,
        txHash,
        contractModelId,
        walletAddress: account,
        walletTimestamp,
        walletSignature,
        encryptedUploadId,
        keyHash,
        parentModelId: parentModel?.id || null,
        tags,
        architecture: form.architecture,
        architectureHash: verification?.architectureHash || null,
        verificationStatus: verification?.verificationStatus || "pending",
        verificationScore: verification?.verificationScore || 0,
        modelHash: verification?.modelHash,
        framework: verification?.framework || "Unknown",
        modelFormat: verification?.modelFormat || "Unknown",
        verificationChecks: verification?.checks || null,
        verificationWarnings: verification?.warnings || [],
        version: Number.parseFloat(form.version) || 1,
        versionNotes: form.versionNotes,
      };

      try {
        await createModel(modelPayload);

      } catch (saveErr) {
        console.error("Save metadata error:", saveErr);
        throw saveErr;
      }

      setStep("done");
      setListingResult({ txHash, contractModelId, walletAddress: account });
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
        <p style={{ color: "var(--text2)", marginBottom: 24 }}>Version {form.version} passed static checks, was encrypted before IPFS upload, and was listed on-chain. Moderation may still be pending.</p>
        {ipfsResult && (
          <div className={styles.successBox}>
            <div className={styles.successRow}><span>📦 IPFS Hash:</span><span className={styles.mono}>{ipfsResult.ipfsHash}</span></div>
            <div className={styles.successRow}><span>🗄️ Storage:</span><span>{ipfsResult.provider === "pinata-cloud" ? "Pinata / IPFS" : "Prototype local JSON/IPFS store"}</span></div>
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
                <div className={styles.successRow}><span>Encrypted IPFS upload:</span><span className="badge badge-blue">Key withheld until on-chain access</span></div>
              </>
            )}
            <div style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--text3)", borderTop: "1px solid var(--border)", paddingTop: 10, textAlign: "left" }}>
              ℹ️ <strong>Static Verification Notice:</strong> Checks file integrity, SHA-256 hash, structure, dependencies, and suspicious content. It does not measure model accuracy or execute live inference.
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
          <button className="btn btn-primary" onClick={() => navigate("/marketplace")}>🛒 View Marketplace</button>
          <button className="btn btn-secondary" onClick={() => { setStep("idle"); setFile(null); setIpfsResult(null); setListingResult(null); setForm({ name: "", description: "", category: "General", architecture: "", price: "0.05", tags: "", version: "1.0", versionNotes: "" }); }}>
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
          <span>🦊 Connect MetaMask to submit the listing transaction.</span>
          <button className="btn btn-outline btn-sm" onClick={connectWallet}>Connect Wallet</button>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

      {parentModel && <div className="alert alert-info" style={{ marginBottom: 20 }}>↳ New version of <strong>{parentModel.name}</strong> (currently v{parentModel.version || "1.0"})</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.infoStrip}>
          <span>Static trust checks</span>
          <span>IPFS ready</span>
          <span>Encrypted paid-model storage</span>
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
              <p style={{ fontSize: "0.82rem", color: "var(--text3)" }}>.onnx, .pt, .pth, .h5, .keras, .safetensors, .zip, .json — Max 100MB</p>
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

        <div className="form-group">
          <label className="form-label" htmlFor="architecture">Architecture fingerprint metadata</label>
          <input id="architecture" name="architecture" className="form-input"
            placeholder="e.g. ResNet-50, 50 layers, image classification"
            value={form.architecture} onChange={handleChange} />
        </div>

        <div className={styles.grid2}>
          <div className="form-group">
            <label className="form-label" htmlFor="price">Price (ETH)</label>
            <input id="price" name="price" type="number" step="0.001" min="0.001" className="form-input"
              placeholder="0.05" value={form.price} onChange={handleChange} />
            {Number(form.price) > 0 && (
              <div style={{ fontSize: "0.82rem", color: "var(--cyan)", marginTop: "6px", display: "flex", gap: "8px", alignItems: "center" }}>
                <span>Primary-sale split: 90% creator / 10% platform before any parent-lineage share.</span>
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
