import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { soundFx } from "../services/soundFx.js";
import Modal from "../components/Modal.jsx";
import styles from "./Wallet.module.css";

function formatHash(hash) {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export default function Wallet() {
  const {
    account,
    chainLabel,
    transactions,
    clearTransactions,
    formatAddress,
    connectDemoWallet,
    connectMetaMask,
    disconnect,
    isDemoWallet,
    connecting,
    ethBalance,
    neuralBalance,
    addTransaction,
    refreshBalances,
  } = useWeb3();

  const toast = useToast();
  const [filter, setFilter] = useState("all"); // "all" | "purchase" | "upload" | "faucet"
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  const displayAccount = account || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const isActuallyConnected = Boolean(account);

  const handleCopyAddress = () => {
    if (!displayAccount) return;
    navigator.clipboard.writeText(displayAccount);
    setCopied(true);
    soundFx.playPop();
    toast.success("Address Copied", "Wallet address copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFaucetTopup = (type, amount) => {
    soundFx.playCoin();
    setFaucetLoading(true);

    const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

    addTransaction({
      hash: txHash,
      status: "success",
      type: "faucet",
      modelName: `${amount} ${type} Faucet Top-up`,
      valueEth: type === "ETH" ? parseFloat(amount) : 0,
      timestamp: new Date().toISOString(),
      meta: { faucetType: type, amount },
    });

    if (typeof refreshBalances === "function") {
      refreshBalances(displayAccount);
    }

    toast.success("Faucet Granted 🚰", `Successfully claimed ${amount} ${type} to test purchases!`);
    setFaucetLoading(false);
  };

  const stats = useMemo(() => {
    const total = transactions.length;
    const success = transactions.filter((t) => t.status === "success").length;
    const totalEth = transactions.reduce((acc, t) => acc + (Number(t.valueEth) || 0), 0);
    const purchasesCount = transactions.filter((t) => t.type === "purchase").length;
    return {
      total,
      success,
      purchasesCount,
      totalEth: totalEth.toFixed(3),
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchFilter =
        filter === "all" ? true : filter === "purchase" ? t.type === "purchase" : t.type === filter;
      const matchSearch =
        !searchQuery.trim() ||
        (t.modelName && t.modelName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.hash && t.hash.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.type && t.type.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchFilter && matchSearch;
    });
  }, [transactions, filter, searchQuery]);

  return (
    <div className="page-wrapper" style={{ paddingTop: 90 }}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>
              <span>⚡</span> Web3 Treasury & Assets
            </div>
            <h1 className={styles.headerTitle}>
              Wallet <span className="gradient-text">Command Center</span>
            </h1>
            <p style={{ color: "var(--text2)", marginTop: 4 }}>
              Manage multi-chain balances, instant testnet faucets, cryptographic licenses, and on-chain receipts.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link to="/marketplace" className="btn btn-primary btn-sm">
              🛒 AI Marketplace
            </Link>
            <Link to="/dashboard" className="btn btn-secondary btn-sm">
              📊 Open Dashboard
            </Link>
          </div>
        </div>

        {/* ─── Top Cards Grid ──────────────────────────────────────────────── */}
        <div className={styles.cardGrid}>
          {/* Holographic Web3 Card */}
          <div className={styles.holoCard}>
            <div className={styles.cardHeaderRow}>
              <div className={styles.cardChip} />
              <div className={styles.networkBadge}>
                <span className={styles.pulseDot} />
                <span>{chainLabel || "Base L2 / Hardhat"}</span>
                <span style={{ color: "var(--cyan)", fontSize: "0.72rem" }}>
                  {isDemoWallet ? "⚡ Demo Wallet" : "🦊 MetaMask"}
                </span>
              </div>
            </div>

            <div className={styles.addressRow}>
              <div className={styles.addressLabel}>Connected Web3 Address</div>
              <button className={styles.addressCopyBtn} onClick={handleCopyAddress} title="Click to copy address">
                <span>{displayAccount ? `${displayAccount.slice(0, 10)}...${displayAccount.slice(-8)}` : "No Wallet Connected"}</span>
                <span style={{ fontSize: "0.8rem", color: copied ? "#34d399" : "var(--cyan)" }}>
                  {copied ? "✓ Copied" : "📋 Copy"}
                </span>
              </button>
            </div>

            <div className={styles.cardBalancesRow}>
              <div>
                <div className={styles.balanceLabel}>ETH Balance (L2 Native)</div>
                <div className={styles.balanceValEth}>Ξ {ethBalance || "10.0000"} ETH</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: "2px" }}>
                  ≈ ${(parseFloat(ethBalance || "10") * 3200).toLocaleString()} USD
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className={styles.balanceLabel}>$NEURAL Token</div>
                <div className={styles.balanceValNeural}>{neuralBalance || "1,000"} NEURAL</div>
                <div style={{ fontSize: "0.75rem", color: "var(--purple-light)", marginTop: "2px" }}>
                  🔥 15% DAO Checkout Discount
                </div>
              </div>
            </div>
          </div>

          {/* Quick Faucet & Wallet Management Card */}
          <div className={`glass-card ${styles.actionsCard}`}>
            <div>
              <div className={styles.faucetTitle}>
                <span>🚰</span> Instant Sandbox Faucet
              </div>
              <p className={styles.faucetDesc} style={{ marginTop: "6px" }}>
                Top up test tokens with zero gas fees to test model licensing, purchasing, and royalties.
              </p>
            </div>

            <div className={styles.faucetBtns}>
              <button
                className={styles.faucetBtn}
                onClick={() => handleFaucetTopup("ETH", "5.0")}
                disabled={faucetLoading}
              >
                <span>💎</span> +5.0 ETH Faucet
              </button>
              <button
                className={styles.faucetBtn}
                style={{ color: "var(--purple-light)", borderColor: "rgba(123, 94, 167, 0.35)", background: "rgba(123, 94, 167, 0.12)" }}
                onClick={() => handleFaucetTopup("NEURAL", "2,500")}
                disabled={faucetLoading}
              >
                <span>🪙</span> +2,500 NEURAL
              </button>
            </div>

            <div className={styles.walletTogglesRow}>
              {isDemoWallet ? (
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={connectMetaMask} disabled={connecting}>
                  🦊 Switch to MetaMask
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={connectDemoWallet} disabled={connecting}>
                  ⚡ Switch to Demo Wallet
                </button>
              )}
              {isActuallyConnected && (
                <button className="btn btn-ghost btn-sm" style={{ color: "#ef4444" }} onClick={disconnect}>
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Metric Stats Bar ────────────────────────────────────────────── */}
        <div className={styles.statsGrid}>
          <div className={`glass-card ${styles.statCard}`}>
            <div className={styles.statIcon}>🧾</div>
            <div className={styles.statLabel}>Total Transactions</div>
            <div className={styles.statValue}>{stats.total}</div>
          </div>
          <div className={`glass-card ${styles.statCard}`}>
            <div className={styles.statIcon}>💎</div>
            <div className={styles.statLabel}>Purchased Licenses</div>
            <div className={styles.statValue} style={{ color: "var(--cyan)" }}>
              {stats.purchasesCount}
            </div>
          </div>
          <div className={`glass-card ${styles.statCard}`}>
            <div className={styles.statIcon}>📊</div>
            <div className={styles.statLabel}>Total Volume Spent</div>
            <div className={styles.statValue}>Ξ {stats.totalEth}</div>
          </div>
          <div className={`glass-card ${styles.statCard}`}>
            <div className={styles.statIcon}>⚡</div>
            <div className={styles.statLabel}>Confirmed Tx Rate</div>
            <div className={styles.statValue} style={{ color: "#34d399" }}>
              {stats.total > 0 ? `${Math.round((stats.success / stats.total) * 100)}%` : "100%"}
            </div>
          </div>
        </div>

        {/* ─── Transaction Activity Table ─────────────────────────────────── */}
        <div className={`glass-card ${styles.tableCard}`}>
          <div className={styles.tableHeader}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>📜 Transaction & License Ledger</h2>
              <div style={{ color: "var(--text3)", fontSize: "0.82rem", marginTop: "2px" }}>
                Immutable cryptographic activity logged for this account.
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <div className={styles.filterTabs}>
                <button
                  className={`${styles.filterBtn} ${filter === "all" ? styles.filterBtnActive : ""}`}
                  onClick={() => setFilter("all")}
                >
                  All ({transactions.length})
                </button>
                <button
                  className={`${styles.filterBtn} ${filter === "purchase" ? styles.filterBtnActive : ""}`}
                  onClick={() => setFilter("purchase")}
                >
                  🛒 Purchases
                </button>
                <button
                  className={`${styles.filterBtn} ${filter === "faucet" ? styles.filterBtnActive : ""}`}
                  onClick={() => setFilter("faucet")}
                >
                  🚰 Faucets
                </button>
              </div>

              {transactions.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--text3)" }}
                  onClick={clearTransactions}
                  title="Clear locally stored history"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text2)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>⛓️</div>
              <h3 style={{ color: "var(--text)" }}>No transactions matching your filter</h3>
              <p style={{ maxWidth: "420px", margin: "8px auto 20px", fontSize: "0.9rem", color: "var(--text3)" }}>
                Acquire an AI model license from the marketplace or claim testnet tokens from the faucet above.
              </p>
              <Link to="/marketplace" className="btn btn-primary btn-sm">
                🛒 Browse AI Marketplace
              </Link>
            </div>
          ) : (
            <div className={styles.table}>
              <div className={styles.rowHead}>
                <div>Type</div>
                <div>Description / Model</div>
                <div>Status</div>
                <div>Amount</div>
                <div>Tx Hash</div>
                <div>Timestamp</div>
              </div>

              {filteredTransactions.map((tx, idx) => (
                <div key={tx.id || `${tx.hash}-${idx}`} className={styles.row}>
                  <div>
                    <span className={styles.badge}>
                      {tx.type === "purchase" ? "🛒 Purchase" : tx.type === "faucet" ? "🚰 Faucet" : "⚡ Tx"}
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, color: "var(--text)" }}>
                    {tx.modelId ? (
                      <Link to={`/model/${tx.modelId}`} style={{ color: "var(--cyan)", textDecoration: "none" }}>
                        {tx.modelName || `Model #${tx.modelId}`} →
                      </Link>
                    ) : (
                      tx.modelName || "On-Chain Transaction"
                    )}
                  </div>

                  <div>
                    <span className={`${styles.status} ${styles["status_" + (tx.status || "success")] || styles.status_success}`}>
                      ✓ {tx.status || "Success"}
                    </span>
                  </div>

                  <div className={styles.mono} style={{ color: tx.valueEth ? "var(--cyan)" : "var(--text2)" }}>
                    {tx.valueEth ? `Ξ ${tx.valueEth} ETH` : "—"}
                  </div>

                  <div className={styles.mono}>
                    <button
                      style={{ background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem" }}
                      onClick={() => {
                        navigator.clipboard.writeText(tx.hash);
                        toast.info("Tx Hash Copied", formatHash(tx.hash));
                      }}
                      title="Click to copy full transaction hash"
                    >
                      {formatHash(tx.hash)} 📋
                    </button>
                  </div>

                  <div style={{ color: "var(--text3)", fontSize: "0.82rem" }}>
                    {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() + " " + new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


