import { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { useWeb3 } from "../context/Web3Context.jsx";
import { purchaseModel, downloadModelBundle } from "../services/api";
import { soundFx } from "../services/soundFx.js";
import styles from "./CheckoutModal.module.css";

export default function CheckoutModal({ isOpen, onClose, model, onPurchaseSuccess }) {
  const {
    account,
    signer,
    chainId,
    ethBalance,
    neuralBalance,
    connectMetaMask,
    connecting,
    refreshBalances,
    refreshTransactions,
  } = useWeb3();

  const [paymentMode, setPaymentMode] = useState("ETH");
  const [activeStep, setActiveStep] = useState(0); // 0: Config/Review, 1: Authorizing, 2: Mining, 3: Minting/Verifying, 4: Done
  const [purchaseError, setPurchaseError] = useState(null);

  // Success Receipt State
  const [receiptData, setReceiptData] = useState(null);

  const basePriceEth = useMemo(() => {
    const n = Number(model?.price);
    return Number.isFinite(n) ? n : 0.012;
  }, [model?.price]);

  const priceEth = useMemo(() => basePriceEth.toFixed(3), [basePriceEth]);

  const priceNeural = useMemo(() => {
    return Math.round(Number(priceEth) * 1000);
  }, [priceEth]);
  const hasParentModel = Number(model?.parentModelId) > 0;

  if (!isOpen || !model) return null;

  const handleExecuteCheckout = async () => {
    setPurchaseError(null);
    soundFx.playClick();
    setActiveStep(1);
    try {
      if (!account || !signer) throw new Error("Connect MetaMask before purchasing a license.");
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      const tokenAddress = import.meta.env.VITE_NEURAL_TOKEN_ADDRESS;
      if (!/^\d+$/.test(String(model.contractModelId || ""))) {
        throw new Error("This model does not have a valid on-chain listing.");
      }
      const { ethers } = await import("ethers");
      const [{ default: marketplaceArtifact }, { default: tokenArtifact }] = await Promise.all([
        import("../contracts/ModelMarketplace.json"),
        import("../contracts/NeuralToken.json"),
      ]);
      const marketplace = new ethers.Contract(contractAddress, marketplaceArtifact.abi, signer);
      const chainModelId = BigInt(model.contractModelId);
      const exactPriceWei = await marketplace.calculatePriceForTier(chainModelId, 1);
      const exactTokenAmount = exactPriceWei * 1000n;
      const exactPriceEth = ethers.formatEther(exactPriceWei);
      const exactPriceNeural = ethers.formatUnits(exactTokenAmount, 18);
      let tx;
      if (paymentMode === "NEURAL") {
        const token = new ethers.Contract(tokenAddress, tokenArtifact.abi, signer);
        const tokenAmount = exactTokenAmount;
        const allowance = await token.allowance(account, contractAddress);
        if (allowance < tokenAmount) {
          const approval = await token.approve(contractAddress, tokenAmount);
          await approval.wait();
        }
        setActiveStep(2);
        tx = await marketplace.buyModelWithNeural(chainModelId);
      } else {
        setActiveStep(2);
        tx = await marketplace.buyModel(chainModelId, { value: exactPriceWei });
      }
      const chainReceipt = await tx.wait();
      if (!chainReceipt || chainReceipt.status !== 1) throw new Error("Purchase transaction was not confirmed successfully.");

      setActiveStep(3);
      const res = await purchaseModel(
        model.id,
        tx.hash,
        account,
        paymentMode,
        paymentMode === "NEURAL" ? exactPriceNeural : exactPriceEth,
        1,
        model.parentModelId || null
      );

      const receipt = {
        txHash: tx.hash,
        nftId: res.data?.nftId || model.contractModelId,
        tier: "Standard access",
        paymentMode,
        amountFormatted:
          paymentMode === "NEURAL"
            ? `${exactPriceNeural} NEURAL`
            : `Ξ ${exactPriceEth} ETH`,
        downloadUrl: res.data?.downloadUrl || null,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };

      setReceiptData(receipt);
      soundFx.playSuccess();

      await Promise.all([refreshBalances(account), refreshTransactions(account)]);

      if (typeof onPurchaseSuccess === "function") {
        onPurchaseSuccess(receipt);
      }

      setActiveStep(4); // Finished!
    } catch (err) {
      console.error("Purchase finalization error:", err);
      setPurchaseError(err.response?.data?.error || err.message || "Failed to finalize license verification.");
      setActiveStep(0);
    }
  };

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleArea}>
            <div className={styles.modelIcon}>{model.category === "Audio" ? "🎙️" : model.category === "Computer Vision" ? "👁️" : "🧠"}</div>
            <div>
              <h2 className={styles.modalHeading}>              {activeStep === 4 ? "License recorded" : `Acquire License: ${model.name}`}</h2>
              <p className={styles.modalSubheading}>
                {activeStep === 4 ? "Purchase recorded on-chain • Sign a key-release request to download" : "Primary-sale license purchase"}
              </p>
            </div>
            {!account && (
              <button className="btn btn-outline" onClick={connectMetaMask} disabled={connecting}>
                {connecting ? "Connecting..." : "Connect MetaMask"}
              </button>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {activeStep === 0 && (
            <div>
              {/* Step 1: Single license tier */}
              <div className={styles.paymentSectionTitle}>
                <span>1. License Access</span>
                <span style={{ color: "#00f5c4" }}>Non-transferable ERC-1155 license</span>
              </div>

              <div className={styles.cryptoStatusCard}>
                <strong>Standard access</strong>
                <p style={{ color: "#94a3b8", margin: "0.4rem 0 0" }}>
                  Access terms follow the listing metadata. This license does not expire or transfer.
                </p>
              </div>

              {/* Step 2: Payment Selector */}
              <div className={styles.paymentSectionTitle}>
                <span>2. Payment Method</span>
              </div>

              <div className={styles.paymentTabs}>
                <div
                  className={`${styles.paymentTab} ${paymentMode === "ETH" ? styles.paymentTabSelected : ""}`}
                  onClick={() => setPaymentMode("ETH")}
                >
                  <span className={styles.paymentIcon}>💎</span>
                  <span className={styles.paymentLabel}>ETH / L2</span>
                </div>

                <div
                  className={`${styles.paymentTab} ${paymentMode === "NEURAL" ? styles.paymentTabSelected : ""}`}
                  onClick={() => setPaymentMode("NEURAL")}
                >
                  <span className={styles.paymentIcon}>🪙</span>
                  <span className={styles.paymentLabel}>$NEURAL</span>
                </div>
              </div>

              {/* Payment Detail Section */}
              <div className={styles.cryptoStatusCard}>
                  <div className={styles.cryptoRow}>
                    <span style={{ color: "#94a3b8" }}>Chain ID:</span>
                    <span>{chainId}</span>
                  </div>
                  <div className={styles.cryptoRow}>
                    <span style={{ color: "#94a3b8" }}>Connected Account:</span>
                    <strong style={{ color: "#fff", fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Not connected"}
                    </strong>
                  </div>
                  {paymentMode === "NEURAL" ? (
                    <div className={styles.cryptoRow}>
                      <span style={{ color: "#94a3b8" }}>NEURAL Balance:</span>
                      <strong style={{ color: "#c084fc" }}>{neuralBalance} NEURAL</strong>
                    </div>
                  ) : (
                    <div className={styles.cryptoRow}>
                      <span style={{ color: "#94a3b8" }}>ETH Balance:</span>
                      <strong style={{ color: "#00f5c4" }}>Ξ {ethBalance} ETH</strong>
                    </div>
                  )}
                </div>

              {/* Summary Box */}
              <div className={styles.summaryBox}>
                <div className={styles.summaryRow}>
                  <span>License</span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>Standard access</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Listing creator share{hasParentModel ? " (80%)" : " (90%)"}</span>
                  <span style={{ color: "#34d399" }}>
                    {paymentMode === "NEURAL"
                      ? `${(Number(priceNeural) * (hasParentModel ? 0.8 : 0.9)).toFixed(2)} NEURAL`
                      : `Ξ ${(Number(priceEth) * (hasParentModel ? 0.8 : 0.9)).toFixed(3)} ETH`}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Platform fee (10%)</span>
                  <span>
                    {paymentMode === "NEURAL"
                      ? `${(Number(priceNeural) * 0.1).toFixed(2)} NEURAL`
                      : `Ξ ${(Number(priceEth) * 0.1).toFixed(3)} ETH`}
                  </span>
                </div>
                {hasParentModel && (
                  <div className={styles.summaryRow}>
                    <span>Parent creator share (10%)</span>
                    <span>
                      {paymentMode === "NEURAL"
                        ? `${(Number(priceNeural) * 0.1).toFixed(2)} NEURAL`
                        : `Ξ ${(Number(priceEth) * 0.1).toFixed(3)} ETH`}
                    </span>
                  </div>
                )}
                <div className={styles.summaryTotalRow}>
                  <span>Total Due</span>
                  <span className={styles.totalHighlight}>
                    {paymentMode === "NEURAL"
                      ? `${priceNeural} NEURAL`
                      : `Ξ ${priceEth} ETH`}
                  </span>
                </div>
              </div>

              {purchaseError && (
                <div style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "1rem", textAlign: "center" }}>
                  ❌ {purchaseError}
                </div>
              )}

              <button className={styles.checkoutBtn} onClick={handleExecuteCheckout}>
                <span>🔐</span>
                <span>
                  Confirm & Mint License NFT (
                  {paymentMode === "NEURAL"
                    ? `${priceNeural} NEURAL`
                    : `Ξ ${priceEth} ETH`}
                  )
                </span>
              </button>
            </div>
          )}

          {/* Processing Animation */}
          {(activeStep === 1 || activeStep === 2 || activeStep === 3) && (
            <div className={styles.processingContainer}>
              <div className={styles.cyberSpinner} />
              <h3 style={{ color: "#fff", marginBottom: "0.4rem" }}>
                {activeStep === 1
                  ? "Preparing purchase transaction..."
                  : activeStep === 2
                  ? "Broadcasting Transaction to EVM Mempool..."
                  : "Minting Soulbound License NFT..."}
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                Please confirm the cryptographic signature in your wallet...
              </p>

              <div className={styles.stepTimeline}>
                <div className={`${styles.stepItem} ${activeStep >= 1 ? styles.stepActive : ""}`}>
                  <span>{activeStep > 1 ? "✓" : "1️⃣"}</span>
                  <span>Confirm purchase in the connected wallet</span>
                </div>
                <div className={`${styles.stepItem} ${activeStep >= 2 ? styles.stepActive : ""}`}>
                  <span>{activeStep > 2 ? "✓" : "2️⃣"}</span>
                  <span>Record primary-sale payment and access on-chain</span>
                </div>
                <div className={`${styles.stepItem} ${activeStep >= 3 ? styles.stepActive : ""}`}>
                  <span>{activeStep > 3 ? "✓" : "3️⃣"}</span>
                  <span>Minting Non-Transferable ERC-1155 NFT</span>
                </div>
                <div className={`${styles.stepItem} ${activeStep >= 4 ? styles.stepActive : ""}`}>
                  <span>4️⃣</span>
                  <span>Verify the mined purchase event</span>
                </div>
              </div>
            </div>
          )}

          {/* Success Holographic Receipt */}
          {activeStep === 4 && receiptData && (
            <div className={styles.successContainer}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
              <h2 style={{ color: "#00f5c4", marginBottom: "0.25rem", fontSize: "1.5rem" }}>
                Access License Minted Successfully!
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                The non-transferable license was recorded on-chain. Sign a separate request to release the decryption key.
              </p>

              {/* Holographic NFT Card */}
              <div className={styles.holographicCard}>
                <div className={styles.nftBadgeTop}>
                  <span className={styles.nftTokenId}>Token #{receiptData.nftId}</span>
                  <span className={styles.nftTierPill}>{receiptData.tier}</span>
                </div>

                <div className={styles.nftModelName}>{model.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.75rem" }}>
                  Framework: <strong>{model.framework}</strong> • Format: <strong>{model.modelFormat}</strong>
                </div>

                <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                  SHA-256 Model Checksum
                </div>
                <div className={styles.nftHashRow}>{model.modelHash}</div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#cbd5e1" }}>
                  <span>Price Paid: <strong style={{ color: "#00f5c4" }}>{receiptData.amountFormatted}</strong></span>
                  <span>Issued: {receiptData.date}</span>
                </div>
              </div>

              {/* Actions */}
              <div className={styles.receiptActions}>
                <button onClick={() => downloadModelBundle(model.id, model.fileName || `${model.name || "model"}.model`, account, signer)} className={styles.downloadButton}>
                  <span>📥</span>
                  <span>Download encrypted model and decrypt after access check</span>
                </button>
                <button
                  className={styles.apiKeyBtn}
                  onClick={() => {
                    onClose();
                    window.location.href = "/developers";
                  }}
                >
                  ⚡ Open Developer Portal & Generate API Keys
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
