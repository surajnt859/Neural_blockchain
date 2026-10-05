import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getProposals, createProposal, castVote } from "../services/api";
import { useWeb3 } from "../context/Web3Context.jsx";
import Modal from "../components/Modal";
import styles from "./Governance.module.css";

export default function Governance() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProposal, setNewProposal] = useState({ title: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const { account, provider, signer, connectWallet } = useWeb3();
  const [neuralBalance, setNeuralBalance] = useState("0");

  useEffect(() => {
    if (!account || !provider || !import.meta.env.VITE_NEURAL_TOKEN_ADDRESS) return;
    import("../contracts/NeuralToken.json").then(async ({ default: tokenData }) => {
      const token = new ethers.Contract(import.meta.env.VITE_NEURAL_TOKEN_ADDRESS, tokenData.abi, provider);
      setNeuralBalance(ethers.formatUnits(await token.balanceOf(account), 18));
    }).catch(() => setNeuralBalance("0"));
  }, [account, provider]);

  const fetchProposals = async () => {
    try {
      const res = await getProposals();
      setProposals(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProposals(); }, []);

  const handleVote = async (id, type) => {
    setVotingId(id);
    try {
      if (!account) throw new Error("Connect a wallet to vote.");
      if (!signer) throw new Error("Connect a wallet to vote.");
      const timestamp = Date.now();
      const signature = await signer.signMessage(`NeuralChain governance vote:${id}:${type}:${timestamp}`);
      await castVote(id, { voteType: type, walletAddress: account, signature, timestamp });
      await fetchProposals();
    } catch (err) {
      alert(err.response?.data?.error || "Vote failed");
    } finally {
      setVotingId(null);
    }
  };

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    if (!newProposal.title || !newProposal.description) return;
    
    setSubmitting(true);
    try {
      if (!account) throw new Error("Connect a wallet to create a proposal.");
      if (!signer) throw new Error("Connect a wallet to create a proposal.");
      const timestamp = Date.now();
      const signature = await signer.signMessage(`NeuralChain governance proposal:${newProposal.title}:${newProposal.description}:${timestamp}`);
      await createProposal({ ...newProposal, walletAddress: account, signature, timestamp });
      setIsModalOpen(false);
      setNewProposal({ title: "", description: "" });
      fetchProposals();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create proposal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ paddingTop: 100, maxWidth: 1000 }}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="section-title">DAO <span className="gradient-text">Governance</span></h1>
          <p style={{ color: "var(--text2)" }}>Shape the future of NeuralChain</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} disabled={!account || Number(neuralBalance) < 100} title={!account ? "Connect a wallet first" : "Requires at least 100 NEURAL"}>➕ New Proposal</button>
      </div>

      <div className={`glass-card ${styles.statsCard}`} style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div><strong>NEURAL Voting Power</strong><div className={styles.statVal}>{Number(neuralBalance).toLocaleString()} NEURAL</div></div>
        {!account && <button className="btn btn-outline btn-sm" onClick={connectWallet}>Connect Wallet</button>}
        {account && Number(neuralBalance) < 1 && <span className="badge badge-amber">Hold NEURAL to vote</span>}
        {account && Number(neuralBalance) >= 100 && <span className="badge badge-cyan">Proposal threshold met</span>}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create New Proposal"
      >
        <form onSubmit={handleSubmitProposal} className={styles.proposalForm}>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Title</label>
            <input 
              className="form-input" 
              placeholder="e.g. Expand dataset storage" 
              value={newProposal.title}
              onChange={(e) => setNewProposal({...newProposal, title: e.target.value})}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Description</label>
            <textarea 
              className="form-input" 
              placeholder="Provide details about your proposal..." 
              value={newProposal.description}
              onChange={(e) => setNewProposal({...newProposal, description: e.target.value})}
              required
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1, justifyContent: "center" }}>
              {submitting ? "Submitting..." : "Submit Proposal"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <div className={styles.grid}>
        <div className={styles.main}>
          <h2 className={styles.sectionHeading}>Active Proposals</h2>
          {loading ? <div className="spinner" /> : (
            <div className={styles.list}>
              {proposals.map(p => (
                <div key={p.id} className={`glass-card ${styles.proposalCard}`}>
                  <div className={styles.propHeader}>
                    <span className={`badge ${p.status === 'Active' ? 'badge-cyan' : 'badge-green'}`}>{p.status}</span>
                    <span className={styles.propId}>Prop #{p.id}</span>
                  </div>
                  <h3 className={styles.propTitle}>{p.title}</h3>
                  <p className={styles.propDesc}>{p.description}</p>
                  
                  <div className={styles.voteSection}>
                    <div className={styles.voteLabels}>
                      <span>For: {(p.forVotes).toLocaleString()}</span>
                      <span>Against: {(p.againstVotes).toLocaleString()}</span>
                    </div>
                    <div className={styles.voteBar}>
                      <div className={styles.forBar} style={{ width: `${(p.forVotes / (p.forVotes + p.againstVotes + 1)) * 100}%` }} />
                    </div>
                  </div>

                  {p.status === 'Active' && (
                    <div className={styles.actions}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleVote(p.id, 'for')} disabled={votingId === p.id || !account || Number(neuralBalance) < 1}>👍 For</button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleVote(p.id, 'against')} disabled={votingId === p.id || !account || Number(neuralBalance) < 1}>👎 Against</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleVote(p.id, 'abstain')} disabled={votingId === p.id || !account || Number(neuralBalance) < 1}>⚪ Abstain</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.sidebar}>
          <div className={`glass-card ${styles.statsCard}`}>
            <h3>Treasury</h3>
            <div className={styles.statLine}>
              <span>Balance:</span>
              <span className={styles.statVal}>Ξ 425.50</span>
            </div>
            <div className={styles.statLine}>
              <span>NEURAL:</span>
              <span className={styles.statVal}>12,450,000</span>
            </div>
            <hr className="divider" />
            <p style={{ fontSize: "0.8rem", color: "var(--text2)" }}>Treasury funds are used for model grants, infrastructure, and community rewards.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
