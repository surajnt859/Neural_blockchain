import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { register as registerApi } from "../services/api";
import styles from "./Auth.module.css";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // --- Validators ---
  const validateUsername = (username) => {
    if (!username.trim()) return "Username is required.";
    if (!/[a-zA-Z]/.test(username))
      return "Username must contain at least one letter (cannot be only numbers).";
    return null;
  };

  const validateEmail = (email) => {
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const usernameErr = validateUsername(form.username);
    if (usernameErr) { setError(usernameErr); return; }

    const emailErr = validateEmail(form.email);
    if (emailErr) { setError(emailErr); return; }

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await registerApi({ username: form.username, email: form.email, password: form.password });
      login(res.data.user, res.data.token);
      navigate("/marketplace");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Launch your creator profile</div>
          <div className={styles.logo}>✨</div>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.sub}>Join the premium marketplace for verified AI assets and blockchain-driven monetisation.</p>
        </div>

        <div className={styles.trustRow}>
          <span>Trusted launch</span>
          <span>On-chain assets</span>
          <span>Creator rewards</span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input id="username" name="username" type="text" className="form-input"
              placeholder="e.g. AIResearcher42" value={form.username} onChange={handleChange} required />
            <small style={{ color: "#a0aec0", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
              Must contain at least one letter (not only numbers)
            </small>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email Address</label>
            <input id="reg-email" name="email" type="email" autoComplete="email" className="form-input"
              placeholder="you@company.com" value={form.email} onChange={handleChange} required />
            <small style={{ color: "#a0aec0", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
              Use a work or personal email you can access.
            </small>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input id="reg-password" name="password" type="password" className="form-input"
              placeholder="Min. 8 characters" value={form.password} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirm">Confirm Password</label>
            <input id="confirm" name="confirm" type="password" className="form-input"
              placeholder="Repeat password" value={form.confirm} onChange={handleChange} required />
          </div>
          <button id="register-btn" type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Creating account..." : "🚀 Create Account"}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link to="/login" className={styles.switchLink}>Sign in →</Link>
        </p>
      </div>
    </div>
  );
}
