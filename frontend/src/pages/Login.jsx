import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { login as loginApi } from "../services/api";
import styles from "./Auth.module.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validateEmail = (email) => {
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(form.email);
    if (emailErr) { setError(emailErr); return; }

    setLoading(true);
    try {
      const res = await loginApi(form);
      login(res.data.user, res.data.token);
      navigate(location.state?.from?.pathname || "/marketplace", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>NeuralChain access</div>
          <div className={styles.logo}>⛓️</div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Secure access to verified AI models and creator tools.</p>
        </div>

        <div className={styles.trustRow}>
          <span>Verified access</span>
          <span>Web3 ready</span>
          <span>Creator portal</span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input id="email" name="email" type="email" autoComplete="email" className="form-input"
              placeholder="you@company.com" value={form.email} onChange={handleChange} required />
            <small style={{ color: "#a0aec0", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
              Use the email associated with your account.
            </small>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="form-input"
              placeholder="Your password" value={form.password} onChange={handleChange} required />
          </div>
          <button id="login-btn" type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Signing in..." : "🔐 Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center", border: "1px solid rgba(0, 245, 196, 0.35)", background: "rgba(0, 245, 196, 0.08)", color: "#00f5c4" }}
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                const { demoLogin } = await import("../services/api");
                const res = await demoLogin();
                login(res.data.user, res.data.token);
                navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
              } catch (err) {
                setError("Demo login failed: " + (err.response?.data?.error || err.message));
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            ⚡ Demo Login
          </button>
        </div>

        <p className={styles.switch}>
          Don't have an account? <Link to="/register" className={styles.switchLink}>Create one →</Link>
        </p>

        {/* Demo Hint */}
        <div className="alert alert-info" style={{ marginTop: 16, fontSize: "0.83rem" }}>
          💡 Use Demo Login for a local developer session, or sign in with your account.
        </div>
      </div>
    </div>
  );
}
