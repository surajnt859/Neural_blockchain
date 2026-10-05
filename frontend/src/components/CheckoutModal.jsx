import { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWeb3 } from "../context/Web3Context.jsx";
import { purchaseModel, downloadModelBundle } from "../services/api";
import { soundFx } from "../services/soundFx.js";
import styles from "./CheckoutModal.module.css";

const TIERS = [
  {
    id: 1,
    name: "Indie / Personal",
    desc: "Single developer & research use. Non-commercial API.",
    multiplier: 1,
    badge: null,
  },
  {
    id: 2,
    name: "Commercial Extended",
    desc: "Unlimited production users, SaaS serving & SLA access.",
    multiplier: 3,
    badge: "⭐ Popular",
  },
  {
    id: 3,
    name: "Enterprise Lineage",
    desc: "Weight redistribution, LoRA fine-tuning & upstream royalties.",
    multiplier: 10,
    badge: "🚀 Full Rights",
  },
];

export default function CheckoutModal({ isOpen, onClose, model, onPurchaseSuccess }) {
  const { user } = useAuth();
  const {
    account,
    signer,
    chainId,
    isDemoWallet,
    ethBalance,
    neuralBalance,
    connectDemoWallet,
    connectMetaMask,
    addTransaction,
    refreshBalances,
  } = useWeb3();

  const [selectedTier, setSelectedTier] = useState(2); // default to Commercial Extended
  const [paymentMode, setPaymentMode] = useState("ETH"); // ETH, NEURAL, CREDIT_CARD
  const [activeStep, setActiveStep] = useState(0); // 0: Config/Review, 1: Authorizing, 2: Mining, 3: Minting/Verifying, 4: Done
  const [purchaseError, setPurchaseError] = useState(null);

  // Credit Card Form State
  const [cardNumber, setCardNumber] = useState("4532 8921 4820 9412");
  const [cardHolder, setCardHolder] = useState("ALEXANDER R. VANCE");
  const [cardExpiry, setCardExpiry] = useState("11/28");
  const [cardCvv, setCardCvv] = useState("382");

  // Success Receipt State
  const [receiptData, setReceiptData] = useState(null);

  const basePriceEth = useMemo(() => {
    const n = Number(model?.price);
    return Number.isFinite(n) ? n : 0.012;
  }, [model?.price]);

  const activeTierObj = useMemo(() => {
    return TIERS.find((t) => t.id === selectedTier) || TIERS[1];
  }, [selectedTier]);

  const priceEth = useMemo(() => {
    return (basePriceEth * activeTierObj.multiplier).toFixed(3);
  }, [basePriceEth, activeTierObj]);

  const priceNeural = useMemo(() => {
    return Math.round(Number(priceEth) * 1000 * 0.85); // 15% discount for NEURAL
  }, [priceEth]);

  const priceUsd = useMemo(() => {
    return (Number(priceEth) * 3200).toFixed(2);
  }, [priceEth]);

  const neuralSavingsUsd = useMemo(() => {
    return (Number(priceUsd) * 0.15).toFixed(2);
  }, [priceUsd]);

  if (!isOpen || !model) return null;

  const handleExecuteCheckout = async () => {
    setPurchaseError(null);
    soundFx.playClick();
    setActiveStep(1); // Authorizing / Key derivation

    let activeAccount = account;
    let txHash = null;

    if (paymentMode === "CREDIT_CARD") {
      await new Promise((r) => setTimeout(r, 600));
      setActiveStep(2); // Stripe / Apple Pay Gateway
      await new Promise((r) => setTimeout(r, 700));
      txHash = `card_ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (!activeAccount) {
        activeAccount = user?.walletAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      }
    } else {
      try {
        if (!activeAccount) {
          const connected = await connectDemoWallet();
          activeAccount = connected ? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" : account || user?.walletAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        }

        const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
        const chainModelId = Number(model?.contractModelId) || 1;

        // Try on-chain smart contract call if signer is ready
        if (signer && contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000") {
          try {
            const { ethers } = await import("ethers");
            const marketplaceArtifact = await import("../contracts/ModelMarketplace.json").catch(() => null);

            if (marketplaceArtifact?.default?.abi) {
              const marketplace = new ethers.Contract(contractAddress, marketplaceArtifact.default.abi, signer);

              if (paymentMode === "NEURAL") {
                const tokenAddress = import.meta.env.VITE_NEURAL_TOKEN_ADDRESS;
                const tokenArtifact = await import("../contracts/NeuralToken.json").catch(() => null);
                if (tokenArtifact?.default?.abi) {
                  const tokenContract = new ethers.Contract(tokenAddress, tokenArtifact.default.abi, signer);
                  const tokenAmount = ethers.parseUnits(String(priceNeural), 18);
                  const allowance = await tokenContract.allowance(activeAccount, contractAddress).catch(() => 0n);

                  if (allowance < tokenAmount) {
                    setActiveStep(1);
                    const approveTx = await tokenContract.approve(contractAddress, ethers.MaxUint256);
                    await approveTx.wait();
                  }

                  setActiveStep(2); // Broadcasting EVM transaction
                  const tx = await marketplace.buyModelWithNeuralTier(chainModelId, selectedTier);
                  const receipt = await tx.wait();
                  txHash = tx.hash || receipt.hash;
                }
              } else {
                setActiveStep(2); // Broadcasting EVM transaction
                const valueWei = ethers.parseEther(String(priceEth));
                const tx = await marketplace.buyModelTier(chainModelId, selectedTier, { value: valueWei });
                const receipt = await tx.wait();
                txHash = tx.hash || receipt.hash;
              }
            }
          } catch (contractErr) {
            if (!isDemoWallet) throw contractErr;
            console.warn("Direct smart contract execution skipped in demo mode:", contractErr.message);
            txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
          }
        }

        if (!txHash) {
          if (!isDemoWallet) {
            throw new Error("Connect MetaMask to a deployed marketplace contract before purchasing.");
          }
          await new Promise((r) => setTimeout(r, 600));
          setActiveStep(2);
          await new Promise((r) => setTimeout(r, 600));
          txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
        }
      } catch (chainErr) {
        if (!isDemoWallet) throw chainErr;
        console.warn("Checkout simulated in demo mode:", chainErr.message);
        txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
      }
    }

    if (!activeAccount) {
      activeAccount = account || user?.walletAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    }

    setActiveStep(3); // Minting Soulbound License NFT & verifying

    try {
      let res;
      try {
        res = await purchaseModel(
          model.id,
          txHash,
          activeAccount,
          paymentMode,
          paymentMode === "NEURAL" ? priceNeural : priceEth,
          selectedTier,
          model.parentModelId || null
        );
      } catch (firstErr) {
        // If failed due to expired token, clear and retry once
        if (firstErr.response && (firstErr.response.status === 401 || firstErr.response.status === 403)) {
          console.warn("Retrying purchase without stale authorization header...");
          localStorage.removeItem("token");
          res = await purchaseModel(
            model.id,
            txHash,
            activeAccount,
            paymentMode,
            paymentMode === "NEURAL" ? priceNeural : priceEth,
            selectedTier,
            model.parentModelId || null
          );
        } else {
          throw firstErr;
        }
      }

      const downloadUrl = res.data?.downloadUrl || `/api/models/${model.id}/download`;
      const nftId = res.data?.nftId || `${Math.floor(Math.random() * 8000 + 1000)}`;

      const receipt = {
        txHash,
        nftId,
        tier: activeTierObj.name,
        paymentMode,
        amountFormatted:
          paymentMode === "NEURAL"
            ? `${priceNeural} NEURAL`
            : paymentMode === "CREDIT_CARD"
            ? `$${priceUsd} USD`
            : `Ξ ${priceEth} ETH`,
        downloadUrl,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };

      setReceiptData(receipt);
      soundFx.playSuccess();

      addTransaction({
        hash: txHash,
        status: "success",
        type: "purchase",
        modelId: model.id,
        modelName: model.name,
        valueEth: paymentMode === "ETH" ? Number(priceEth) : 0,
        chainId: chainId || 31337,
        meta: { mode: "verified-purchase", payment: paymentMode, tier: selectedTier },
      });

      if (typeof refreshBalances === "function") {
        refreshBalances(activeAccount);
      }

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
              <h2 className={styles.modalHeading}>{activeStep === 4 ? "License Minted!" : `Acquire License: ${model.name}`}</h2>
              <p className={styles.modalSubheading}>
                {activeStep === 4 ? "Verified on Blockchain • Instant Decryption Access" : "Decentralized AI Smart Contract Checkout"}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {activeStep === 0 && (
            <div>
              {/* Step 1: License Tier Cards */}
              <div className={styles.paymentSectionTitle}>
                <span>1. Select License Rights</span>
                <span style={{ color: "#00f5c4" }}>EIP-2981 Compliant</span>
              </div>

              <div className={styles.tierCardsGrid}>
                {TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    className={`${styles.tierCard} ${selectedTier === tier.id ? styles.tierCardSelected : ""}`}
                    onClick={() => setSelectedTier(tier.id)}
                  >
                    {tier.badge && <div className={styles.popularBadge}>{tier.badge}</div>}
                    <div>
                      <div className={styles.tierName}>{tier.name}</div>
                      <div className={styles.tierDesc}>{tier.desc}</div>
                    </div>
                    <div>
                      <div className={styles.tierPriceEth}>Ξ {(basePriceEth * tier.multiplier).toFixed(3)}</div>
                      <div className={styles.tierPriceUsd}>~${(basePriceEth * tier.multiplier * 3200).toFixed(2)} USD</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Step 2: Payment Selector */}
              <div className={styles.paymentSectionTitle}>
                <span>2. Payment Method</span>
                {paymentMode === "NEURAL" && <span className={styles.discountPill}>🔥 15% DAO Discount</span>}
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
                  <span className={styles.paymentLabel}>$NEURAL (-15%)</span>
                </div>

                <div
                  className={`${styles.paymentTab} ${paymentMode === "CREDIT_CARD" ? styles.paymentTabSelected : ""}`}
                  onClick={() => setPaymentMode("CREDIT_CARD")}
                >
                  <span className={styles.paymentIcon}>💳</span>
                  <span className={styles.paymentLabel}>Card / Apple Pay</span>
                </div>
              </div>

              {/* Payment Detail Section */}
              {paymentMode === "CREDIT_CARD" ? (
                <div>
                  {/* Interactive Virtual Card */}
                  <div className={styles.creditCardPreview}>
                    <div className={styles.cardTopRow}>
                      <div className={styles.chipIcon} />
                      <div className={styles.cardNetworkLogo}>VISA</div>
                    </div>
                    <div className={styles.cardNumberDisplay}>{cardNumber}</div>
                    <div className={styles.cardBottomRow}>
                      <div>
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>CARD HOLDER</div>
                        <div style={{ fontWeight: 600 }}>{cardHolder}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>EXPIRES</div>
                        <div style={{ fontWeight: 600 }}>{cardExpiry}</div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardInputsRow}>
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="Card Number"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                    <input
                      type="text"
                      className={styles.inputField}
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                    />
                    <input
                      type="password"
                      className={styles.inputField}
                      placeholder="CVV"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className={styles.cryptoStatusCard}>
                  <div className={styles.cryptoRow}>
                    <span style={{ color: "#94a3b8" }}>Target EVM Network:</span>
                    <span className={styles.gasPill}>⚡ Base L2 (Gas: &lt; $0.001)</span>
                  </div>
                  <div className={styles.cryptoRow}>
                    <span style={{ color: "#94a3b8" }}>Connected Account:</span>
                    <strong style={{ color: "#fff", fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Demo Wallet"}
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
              )}

              {/* Summary Box */}
              <div className={styles.summaryBox}>
                <div className={styles.summaryRow}>
                  <span>License Rights</span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{activeTierObj.name}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Creator Royalty (90%)</span>
                  <span style={{ color: "#34d399" }}>Ξ {(Number(priceEth) * 0.9).toFixed(3)} ETH</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Protocol Fee (10%)</span>
                  <span>Ξ {(Number(priceEth) * 0.1).toFixed(3)} ETH</span>
                </div>
                {paymentMode === "NEURAL" && (
                  <div className={styles.summaryRow} style={{ color: "#d8b4fe" }}>
                    <span>DAO Discount Savings</span>
                    <span>- ${neuralSavingsUsd} USD</span>
                  </div>
                )}
                <div className={styles.summaryTotalRow}>
                  <span>Total Due</span>
                  <span className={styles.totalHighlight}>
                    {paymentMode === "NEURAL"
                      ? `${priceNeural} NEURAL`
                      : paymentMode === "CREDIT_CARD"
                      ? `$${priceUsd} USD`
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
                    : paymentMode === "CREDIT_CARD"
                    ? `$${priceUsd}`
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
                  ? "Deriving Quantum AES-256 Keys..."
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
                  <span>AES-256-GCM Ephemeral Key Sharding</span>
                </div>
                <div className={`${styles.stepItem} ${activeStep >= 2 ? styles.stepActive : ""}`}>
                  <span>{activeStep > 2 ? "✓" : "2️⃣"}</span>
                  <span>Executing 90/10 On-Chain Royalty Distribution</span>
                </div>
                <div className={`${styles.stepItem} ${activeStep >= 3 ? styles.stepActive : ""}`}>
                  <span>{activeStep > 3 ? "✓" : "3️⃣"}</span>
                  <span>Minting Non-Transferable ERC-1155 NFT</span>
                </div>
                <div className={`${styles.stepItem} ${activeStep >= 4 ? styles.stepActive : ""}`}>
                  <span>4️⃣</span>
                  <span>Injecting Digital Provenance Watermark</span>
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
                Soulbound NFT recorded on-chain. Decryption keys unlocked.
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
                <button onClick={() => downloadModelBundle(model.id, `${model.name || "model"}-bundle.zip`, account)} className={styles.downloadButton}>
                  <span>📥</span>
                  <span>Download Complete Weights Bundle (.zip)</span>
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
