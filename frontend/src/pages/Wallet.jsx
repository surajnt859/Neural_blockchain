import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context.jsx";
import styles from "./Wallet.module.css";

function formatHash(hash) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export default function Wallet() {
  const {
    account,
    chainId,
    transactions,
    transactionsLoading,
    transactionError,
    connectWallet,
    connectDemoWallet,
    isDemo,
    disconnect,
    connecting,
    error,
    ethBalance,
    neuralBalance,
  } = useWeb3();

  return (
    <div className="page-wrapper" style={{ paddingTop: 90 }}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>{isDemo ? "Hardhat demo · On-chain activity" : "Wallet · On-chain activity"}</div>
            <h1 className={styles.headerTitle}>Wallet</h1>
            <p style={{ color: "var(--text2)", marginTop: 4 }}>
              Balances and transaction events read from the connected network.
            </p>
          </div>
          <div className={styles.walletActions}>
            <Link to="/marketplace" className="btn btn-primary btn-sm">Marketplace</Link>
            {account ? (
              <button className="btn btn-secondary btn-sm" onClick={disconnect}>Disconnect</button>
            ) : (
              <>
              <button className="btn btn-secondary btn-sm" onClick={connectWallet} disabled={connecting}>
                {connecting ? "Connecting..." : "Connect MetaMask"}
              </button>
              {import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_WALLET === "true" && (
                <button className="btn btn-secondary btn-sm" onClick={connectDemoWallet} disabled={connecting}>
                  {connecting ? "Connecting..." : "Use Demo Wallet (Hardhat)"}
                </button>
              )}
              </>
            )}
          </div>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {isDemo && (
          <div className={styles.demoBanner} role="status">
            <strong>Demo Wallet</strong> — connected to Hardhat test account #1. Local development only; this is a publicly known test key, not a real wallet. Balances and activity below are read from the local chain.
          </div>
        )}

        <div className={styles.cardGrid}>
          <section className={`glass-card ${styles.actionsCard}`}>
            <h2>Connected account</h2>
            <p>{account || "No wallet connected"}</p>
            <p>Chain ID: {chainId ?? "—"}</p>
          </section>
          <section className={`glass-card ${styles.actionsCard}`}>
            <h2>ETH balance</h2>
            <p>{account && ethBalance !== null ? `${ethBalance} ETH` : "—"}</p>
          </section>
          <section className={`glass-card ${styles.actionsCard}`}>
            <h2>NEURAL balance</h2>
            <p>{account && neuralBalance !== null ? `${neuralBalance} NEURAL` : "—"}</p>
          </section>
        </div>

        <section className={`glass-card ${styles.tableCard}`}>
          <div className={styles.tableHeader}>
            <div>
              <h2>On-chain transaction events</h2>
              <p style={{ color: "var(--text3)" }}>
                ModelPurchased, NeuralPurchase, and NEURAL Transfer events from this contract deployment block.
              </p>
            </div>
          </div>
          {!account ? (
            <p>Connect MetaMask to read activity for this wallet.</p>
          ) : transactionsLoading ? (
            <p>Loading on-chain transactions...</p>
          ) : transactionError ? (
            <p role="alert">Could not read on-chain transactions: {transactionError}</p>
          ) : transactions.length === 0 ? (
            <p>No on-chain transactions found for this wallet on this network.</p>
          ) : (
            <div className={styles.table}>
              {transactions.map((transaction) => (
                <article className={styles.chainTransaction} key={`${transaction.hash}-${transaction.type}-${transaction.blockNumber}`}>
                  <div>
                    <strong>{transaction.type.replaceAll("_", " ")}</strong>
                    {transaction.modelId && <span> · Model #{transaction.modelId}</span>}
                    {transaction.tier && <span> · License tier {transaction.tier}</span>}
                    <div>{transaction.amount} {transaction.currency}</div>
                    <small>Block {transaction.blockNumber}{transaction.timestamp ? ` · ${new Date(transaction.timestamp * 1000).toLocaleString()}` : ""}</small>
                  </div>
                  <code title={transaction.hash}>{formatHash(transaction.hash)}</code>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
