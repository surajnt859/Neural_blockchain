import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useWeb3 } from "../context/Web3Context.jsx";
import { soundFx } from "../services/soundFx.js";
import { useToast } from "../context/ToastContext.jsx";
import styles from "./Navbar.module.css";

export default function Navbar({ onOpenCommandPalette }) {
  const { user, logout } = useAuth();
  const {
    account,
    walletType,
    isDemoWallet,
    isMetaMask,
    ethBalance,
    neuralBalance,
    connectMetaMask,
    connectDemoWallet,
    disconnectWallet,
    connecting,
    error,
  } = useWeb3();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundFx.isEnabled());
  const dropdownRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setWalletDropdownOpen(false);
  }, [location]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setWalletDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    soundFx.playClick();
    logout();
    disconnectWallet();
    toast.info("Logged Out", "You have been disconnected.");
    navigate("/");
  };

  const toggleAudio = () => {
    const next = soundFx.toggle();
    setSoundEnabled(next);
    toast.info("Interface Sound", next ? "Audio feedback enabled" : "Audio muted");
  };

  const isActive = (path) => location.pathname === path;

  const formatAddr = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleNavClick = () => {
    soundFx.playClick();
  };

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link to="/" className={styles.logo} onClick={handleNavClick}>
          <span className={styles.logoIcon}>⚡</span>
          <span>
            Neural<span className={styles.logoAccent}>Chain</span>
          </span>
        </Link>

        {/* Live $NEURAL Token Ticker Pill */}
        <Link to="/governance" className={styles.tickerPill} title="Governance & Staking Token" onClick={handleNavClick}>
          <span>🪙 $NEURAL</span>
          <strong style={{ color: "#00f5c4" }}>$1.42</strong>
          <span className={styles.tickerUp}>▲ +8.4%</span>
        </Link>

        {/* Desktop Navigation Links */}
        <ul className={styles.links}>
          <li>
            <Link to="/marketplace" className={`${styles.link} ${isActive("/marketplace") ? styles.active : ""}`} onClick={handleNavClick}>
              Marketplace
            </Link>
          </li>
          <li>
            <Link to="/dashboard" className={`${styles.link} ${isActive("/dashboard") ? styles.active : ""}`} onClick={handleNavClick}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/bounties" className={`${styles.link} ${styles.secondaryNav} ${isActive("/bounties") ? styles.active : ""}`} onClick={handleNavClick}>
              Bounties <span style={{ fontSize: "0.72rem", background: "rgba(244,63,94,0.2)", color: "#fb7185", padding: "1px 6px", borderRadius: 4, marginLeft: 4 }}>RFM</span>
            </Link>
          </li>
          <li>
            <Link to="/developers" className={`${styles.link} ${isActive("/developers") ? styles.active : ""}`} onClick={handleNavClick}>
              API Gateway
            </Link>
          </li>
          <li>
            <Link to="/compare" className={`${styles.link} ${styles.secondaryNav} ${isActive("/compare") ? styles.active : ""}`} onClick={handleNavClick}>
              Compare
            </Link>
          </li>
          <li>
            <Link to="/leaderboard" className={`${styles.link} ${isActive("/leaderboard") ? styles.active : ""}`} onClick={handleNavClick}>
              Leaderboard
            </Link>
          </li>
          {user && (
            <li>
              <Link to="/upload" className={`${styles.link} ${isActive("/upload") ? styles.active : ""}`} onClick={handleNavClick}>
                Studio
              </Link>
            </li>
          )}
          {user && (
            <li>
              <Link to="/governance" className={`${styles.link} ${isActive("/governance") ? styles.active : ""}`} onClick={handleNavClick}>
                DAO
              </Link>
            </li>
          )}
        </ul>

        {/* Right Section */}
        <div className={styles.right} ref={dropdownRef}>
          {/* Sound FX Toggle */}
          <button
            className={styles.iconBtn}
            onClick={toggleAudio}
            title={soundEnabled ? "Mute Interface Audio" : "Enable Interface Audio"}
            aria-label="Sound Toggle"
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>

          {/* Connected Wallet Pill with Dropdown */}
          {account ? (
            <div className={styles.walletContainer}>
              <button
                className={styles.walletPill}
                onClick={() => {
                  soundFx.playPop();
                  setWalletDropdownOpen(!walletDropdownOpen);
                }}
                title="Click to view wallet details and switch wallets"
              >
                <span className={styles.walletDot} />
                <span className={styles.walletLabel}>
                  {isDemoWallet ? "⚡ Demo Wallet" : "🦊 MetaMask"}
                </span>
                <span className={styles.walletAddr}>{formatAddr(account)}</span>
                <span className={styles.walletBalancesInline} aria-label={`Balance: ${ethBalance} ETH, ${neuralBalance} NEURAL`}>
                  <span>Ξ {ethBalance}</span>
                  <span>{neuralBalance} N</span>
                </span>
                <span className={styles.walletDropdownArrow}>▾</span>
              </button>

              {walletDropdownOpen && (
                <div className={styles.walletDropdown}>
                  <div className={styles.walletDropdownHeader}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Active Web3 Account
                    </div>
                    <div className={styles.dropdownAddress}>{account}</div>
                  </div>

                  <div className={styles.walletBalances}>
                    <div className={styles.balanceRow}>
                      <span style={{ color: "var(--text2)" }}>ETH Balance:</span>
                      <strong style={{ color: "var(--cyan)" }}>Ξ {ethBalance} ETH</strong>
                    </div>
                    <div className={styles.balanceRow}>
                      <span style={{ color: "var(--text2)" }}>NEURAL Balance:</span>
                      <strong style={{ color: "var(--purple-light)" }}>{neuralBalance} NEURAL</strong>
                    </div>
                  </div>

                  <div className={styles.walletActions}>
                    <Link
                      to="/wallet"
                      className="btn btn-secondary btn-sm"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => {
                        soundFx.playClick();
                        setWalletDropdownOpen(false);
                      }}
                    >
                      💳 Open Wallet & Faucet Hub
                    </Link>
                    {isDemoWallet ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => {
                          soundFx.playClick();
                          connectMetaMask();
                          setWalletDropdownOpen(false);
                        }}
                      >
                        🦊 Switch to MetaMask
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => {
                          soundFx.playClick();
                          connectDemoWallet();
                          setWalletDropdownOpen(false);
                        }}
                      >
                        ⚡ Switch to Instant Demo Wallet
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: "100%", color: "#ef4444", justifyContent: "center" }}
                      onClick={() => {
                        soundFx.playClick();
                        disconnectWallet();
                        setWalletDropdownOpen(false);
                      }}
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.walletContainer}>
              <button
                className={styles.walletPill}
                onClick={() => {
                  soundFx.playPop();
                  setWalletDropdownOpen(!walletDropdownOpen);
                }}
                aria-expanded={walletDropdownOpen}
                title="Choose a wallet"
              >
                <span className={styles.walletDot} />
                <span className={styles.walletLabel}>Connect Wallet</span>
                <span className={styles.walletDropdownArrow}>▾</span>
              </button>
              {walletDropdownOpen && (
                <div className={`${styles.walletDropdown} ${styles.connectWalletDropdown}`}>
                  <div className={styles.walletDropdownHeader}>
                    <strong>Choose wallet</strong>
                    <div className={styles.dropdownHint}>Connect a wallet to purchase, publish, and manage models.</div>
                  </div>
                  {import.meta.env.DEV && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { connectDemoWallet(); setWalletDropdownOpen(false); }} disabled={connecting}>
                      ⚡ {connecting ? "Connecting..." : "Local Demo Wallet"}
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => { connectMetaMask(); setWalletDropdownOpen(false); }} disabled={connecting}>
                    🦊 MetaMask
                  </button>
                  {error && <div className="form-error">{error}</div>}
                </div>
              )}
            </div>
          )}

          {/* User Authentication Menu */}
          {user ? (
            <div className={styles.userMenu}>
              <Link to="/dashboard" className={styles.userName} title="Go to Dashboard" onClick={handleNavClick}>
                👤 {user.username}
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <div className={styles.authBtns}>
              <Link to="/login" className="btn btn-secondary btn-sm" onClick={handleNavClick}>
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={handleNavClick}>
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className={styles.hamburger}
            onClick={() => {
              soundFx.playClick();
              setMenuOpen(!menuOpen);
            }}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            <span className={`${styles.bar} ${menuOpen ? styles.open : ""}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.open : ""}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.open : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div id="mobile-navigation" className={styles.mobileMenu}>
          <button
            className={styles.mobileLink}
            onClick={() => {
              setMenuOpen(false);
              onOpenCommandPalette?.();
            }}
          >
            🔍 Search & Commands (⌘K)
          </button>
          <Link to="/marketplace" className={styles.mobileLink} onClick={handleNavClick}>
            🛒 Marketplace
          </Link>
          <Link to="/bounties" className={styles.mobileLink} onClick={handleNavClick}>
            🏆 AI Model Bounties
          </Link>
          <Link to="/developers" className={styles.mobileLink} onClick={handleNavClick}>
            ⚡ API Gateway
          </Link>
          <Link to="/compare" className={styles.mobileLink} onClick={handleNavClick}>
            ⚖️ Compare Models
          </Link>
          <Link to="/leaderboard" className={styles.mobileLink} onClick={handleNavClick}>
            🏆 Leaderboard
          </Link>
          <button className={styles.mobileLink} onClick={toggleAudio}>
            {soundEnabled ? "🔊 Mute interface sound" : "🔇 Enable interface sound"}
          </button>
          {account ? (
            <button className={styles.mobileLink} onClick={() => { disconnectWallet(); setMenuOpen(false); }}>
              🟢 Connected {formatAddr(account)} · Disconnect
            </button>
          ) : (
            <button className={styles.mobileLink} onClick={() => { connectMetaMask(); setMenuOpen(false); }} disabled={connecting}>
              🦊 {connecting ? "Connecting wallet..." : "Connect MetaMask"}
            </button>
          )}
          <Link to="/dashboard" className={styles.mobileLink} onClick={handleNavClick}>
            📊 Dashboard
          </Link>
          {user && (
            <Link to="/upload" className={styles.mobileLink} onClick={handleNavClick}>
              ⬆️ Model Studio
            </Link>
          )}
          {user && (
            <Link to="/governance" className={styles.mobileLink} onClick={handleNavClick}>
              🏛️ DAO Governance
            </Link>
          )}
          {user?.role === "admin" && (
            <Link to="/admin" className={styles.mobileLink} onClick={handleNavClick}>
              🛡️ Trust & Safety
            </Link>
          )}
          {!user && (
            <Link to="/login" className={styles.mobileLink} onClick={handleNavClick}>
              🔐 Login
            </Link>
          )}
          {!user && (
            <Link to="/register" className={styles.mobileLink} onClick={handleNavClick}>
              ✨ Sign Up
            </Link>
          )}
          {user && (
            <button className={styles.mobileLink} onClick={handleLogout}>
              🚪 Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
