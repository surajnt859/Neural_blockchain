import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      background: "var(--bg2)",
      padding: "48px 24px 32px",
      marginTop: "auto"
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40, marginBottom: 40 }}>
          {/* Brand */}
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 12 }}>
              ⛓️ AI<span style={{ background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ModelChain</span>
            </div>
            <p style={{ color: "var(--text2)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              The decentralized marketplace for AI models. Powered by blockchain & IPFS.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: 14, color: "var(--text)" }}>Platform</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["🛒 Marketplace", "/marketplace"], ["⬆️ Upload Model", "/upload"], ["🔐 Login", "/login"]].map(([label, to]) => (
                <Link key={to} to={to} style={{ color: "var(--text2)", fontSize: "0.88rem", transition: "color 0.2s" }}
                  onMouseEnter={e => e.target.style.color = "var(--purple-light)"}
                  onMouseLeave={e => e.target.style.color = "var(--text2)"}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: 14, color: "var(--text)" }}>Tech Stack</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["⛓️", "Ethereum (Sepolia)"], ["📦", "IPFS via Pinata"], ["🦊", "MetaMask"], ["⚛️", "React + Vite"]].map(([icon, tech]) => (
                <div key={tech} style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text2)", fontSize: "0.88rem" }}>
                  <span>{icon}</span><span>{tech}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: 14, color: "var(--text)" }}>Info</h4>
            <p style={{ color: "var(--text2)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              This is a college-level prototype. All transactions use Sepolia testnet ETH (no real money).
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge badge-cyan">Testnet</span>
              <span className="badge badge-purple">Demo</span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <p style={{ color: "var(--text3)", fontSize: "0.82rem" }}>© 2024 AIModelChain. Built with React, Node.js, Solidity & IPFS.</p>
          <p style={{ color: "var(--text3)", fontSize: "0.82rem" }}>🎓 College Blockchain Project</p>
        </div>
      </div>
    </footer>
  );
}
